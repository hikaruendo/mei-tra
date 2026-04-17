/// <reference types="multer" />
import {
  AvatarUploadResponseDto,
  UpdateUserProfileRequestDto,
  UserProfileDto,
} from '@contracts/profile';
import { RecentGameHistoryItemContract } from '@contracts/game-history';
import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import {
  AuthenticatedUser,
  UpdateUserProfileDto,
  UserProfile,
} from '../types/user.types';
import { SupabaseService } from '../database/supabase.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { RecentGameHistoryItem } from '../types/game-history.types';
import { IGetUserRecentGameHistoryUseCase } from '../use-cases/interfaces/get-user-recent-game-history.use-case.interface';
import * as sharp from 'sharp';

@Controller('user-profile')
export class UserProfileController {
  private readonly logger = new Logger(UserProfileController.name);

  constructor(
    @Inject('IUserProfileRepository')
    private readonly userProfileRepository: IUserProfileRepository,
    private readonly supabaseService: SupabaseService,
    @Inject('IGetUserRecentGameHistoryUseCase')
    private readonly getUserRecentGameHistoryUseCase: IGetUserRecentGameHistoryUseCase,
  ) {}

  @Get(':id/game-history')
  @UseGuards(AuthGuard)
  async getRecentGameHistory(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RecentGameHistoryItemContract[]> {
    this.assertProfileOwnership(id, currentUser);
    const history = await this.getUserRecentGameHistoryUseCase.execute(id, 10);
    return history.map((item) => this.toRecentGameHistoryItemDto(item));
  }

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    try {
      const profile = await this.userProfileRepository.findById(id);
      if (!profile) {
        throw new HttpException('Profile not found', HttpStatus.NOT_FOUND);
      }
      return this.toUserProfileDto(profile);
    } catch (error) {
      this.logControllerError(`Failed to get profile for user ${id}`, error);
      throw error;
    }
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  async updateProfile(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() updateData: UpdateUserProfileRequestDto,
  ) {
    try {
      this.assertProfileOwnership(id, currentUser);
      const updatedProfile = await this.userProfileRepository.update(
        id,
        updateData as UpdateUserProfileDto,
      );
      return this.toUserProfileDto(updatedProfile);
    } catch (error) {
      this.logControllerError(`Failed to update profile for user ${id}`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update profile',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/avatar')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }), // 2MB max input
          new FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    try {
      this.assertProfileOwnership(id, currentUser);

      // Optimize image using Sharp
      const optimizedBuffer = await this.optimizeImage(file.buffer);

      // Check optimized size (should be under 50KB)
      if (optimizedBuffer.length > 50 * 1024) {
        throw new HttpException(
          'Optimized image is still too large. Please use a smaller image.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get existing profile to check for old avatar
      const existingProfile = await this.userProfileRepository.findById(id);

      // Delete old avatar if exists
      if (existingProfile?.avatarUrl) {
        await this.deleteOldAvatar(existingProfile.avatarUrl);
      }

      // Upload to Supabase Storage
      const objectPath = `${id}/avatar-${Date.now()}.webp`;
      const { error } = await this.supabaseService.client.storage
        .from('avatars')
        .upload(objectPath, optimizedBuffer, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        this.logger.error('Failed to upload avatar to storage:', error);
        throw new HttpException(
          'Failed to upload avatar',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Get public URL
      const { data: urlData } = this.supabaseService.client.storage
        .from('avatars')
        .getPublicUrl(objectPath);

      // Update user profile with new avatar URL
      const updatedProfile = await this.userProfileRepository.update(id, {
        avatarUrl: urlData.publicUrl,
      });

      const response: AvatarUploadResponseDto = {
        message: 'Avatar uploaded successfully',
        avatarUrl: urlData.publicUrl,
        profile: this.toUserProfileDto(updatedProfile),
      };

      return response;
    } catch (error) {
      this.logControllerError(`Failed to upload avatar for user ${id}`, error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to upload avatar',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private assertProfileOwnership(
    requestedUserId: string,
    currentUser: AuthenticatedUser,
  ): void {
    if (currentUser.id !== requestedUserId) {
      throw new ForbiddenException('Cannot modify another user profile');
    }
  }

  private async optimizeImage(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize(128, 128, {
          fit: 'cover',
          position: 'center',
        })
        .webp({
          quality: 80,
          effort: 6,
        })
        .toBuffer();
    } catch (error) {
      this.logger.error('Failed to optimize image:', error);
      throw new HttpException(
        'Failed to process image',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async deleteOldAvatar(avatarUrl: string): Promise<void> {
    try {
      const objectPath = this.extractAvatarObjectPath(avatarUrl);

      if (objectPath) {
        const { error } = await this.supabaseService.client.storage
          .from('avatars')
          .remove([objectPath]);

        if (error) {
          this.logger.warn('Failed to delete old avatar:', error);
          // Don't throw error as this is not critical
        }
      }
    } catch (error) {
      this.logger.warn('Error deleting old avatar:', error);
      // Don't throw error as this is not critical
    }
  }

  private extractAvatarObjectPath(avatarUrl: string): string | null {
    try {
      const parsed = new URL(avatarUrl);
      const decodedPath = decodeURIComponent(parsed.pathname);
      const marker = '/storage/v1/object/public/avatars/';
      const markerIndex = decodedPath.indexOf(marker);

      if (markerIndex === -1) {
        return null;
      }

      return decodedPath.slice(markerIndex + marker.length);
    } catch {
      return null;
    }
  }

  private logControllerError(message: string, error: unknown): void {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const detail = error.message;

      if (status >= 500) {
        this.logger.error(`${message}: ${detail}`);
        return;
      }

      this.logger.warn(`${message}: ${detail}`);
      return;
    }

    if (error instanceof Error) {
      this.logger.error(`${message}: ${error.message}`);
      return;
    }

    this.logger.error(`${message}: ${String(error)}`);
  }

  private toUserProfileDto(profile: UserProfile): UserProfileDto {
    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      lastSeenAt: profile.lastSeenAt.toISOString(),
      gamesPlayed: profile.gamesPlayed,
      gamesWon: profile.gamesWon,
      totalScore: profile.totalScore,
      preferences: {
        notifications: profile.preferences.notifications,
        sound: profile.preferences.sound,
        theme: profile.preferences.theme,
        fontSize: profile.preferences.fontSize,
      },
    };
  }

  private toRecentGameHistoryItemDto(
    item: RecentGameHistoryItem,
  ): RecentGameHistoryItemContract {
    return {
      roomId: item.roomId,
      roomName: item.roomName,
      completedAt: item.completedAt.toISOString(),
      roundCount: item.roundCount,
      totalEntries: item.totalEntries,
      winningTeam: item.winningTeam,
      lastActionType: item.lastActionType,
    };
  }
}
