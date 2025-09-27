/// <reference types="multer" />
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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { UpdateUserProfileDto } from '../types/user.types';
import { SupabaseService } from '../database/supabase.service';
import * as sharp from 'sharp';

@Controller('user-profile')
export class UserProfileController {
  private readonly logger = new Logger(UserProfileController.name);

  constructor(
    @Inject('IUserProfileRepository')
    private readonly userProfileRepository: IUserProfileRepository,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    try {
      const profile = await this.userProfileRepository.findById(id);
      if (!profile) {
        throw new HttpException('Profile not found', HttpStatus.NOT_FOUND);
      }
      return profile;
    } catch (error) {
      this.logger.error(`Failed to get profile for user ${id}:`, error);
      throw error;
    }
  }

  @Put(':id')
  async updateProfile(
    @Param('id') id: string,
    @Body() updateData: UpdateUserProfileDto,
  ) {
    try {
      const updatedProfile = await this.userProfileRepository.update(
        id,
        updateData,
      );
      return updatedProfile;
    } catch (error) {
      this.logger.error(`Failed to update profile for user ${id}:`, error);
      throw new HttpException(
        'Failed to update profile',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @Param('id') id: string,
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
      const fileName = `avatar-${id}-${Date.now()}.webp`;
      const { error } = await this.supabaseService.client.storage
        .from('avatars')
        .upload(fileName, optimizedBuffer, {
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
        .getPublicUrl(fileName);

      // Update user profile with new avatar URL
      const updatedProfile = await this.userProfileRepository.update(id, {
        avatarUrl: urlData.publicUrl,
      });

      return {
        message: 'Avatar uploaded successfully',
        avatarUrl: urlData.publicUrl,
        profile: updatedProfile,
      };
    } catch (error) {
      this.logger.error(`Failed to upload avatar for user ${id}:`, error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to upload avatar',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
      // Extract filename from URL
      const urlParts = avatarUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];

      if (fileName && fileName.startsWith('avatar-')) {
        const { error } = await this.supabaseService.client.storage
          .from('avatars')
          .remove([fileName]);

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
}
