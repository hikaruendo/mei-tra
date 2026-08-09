import {
  Body,
  Controller,
  Delete,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { PushTokenRegistration } from '@contracts/push';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { AuthenticatedUser } from '../types/user.types';
import type { IPushTokenRepository } from '../repositories/interfaces/push-token.repository.interface';
import {
  parseDeletePushTokenInput,
  parseRegisterPushTokenInput,
} from './push-token.validation';
import { PUSH_TOKEN_REPOSITORY } from './push-notification.service';

@Controller('push-tokens')
@UseGuards(AuthGuard)
export class PushTokenController {
  constructor(
    @Inject(PUSH_TOKEN_REPOSITORY)
    private readonly tokenRepository: IPushTokenRepository,
  ) {}

  @Post()
  async register(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<PushTokenRegistration> {
    const input = parseRegisterPushTokenInput(body);
    const token = await this.tokenRepository.upsertForUser(
      currentUser.id,
      input,
    );

    return {
      id: token.id,
      deviceId: token.deviceId,
      platform: token.platform,
      appVersion: token.appVersion,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    };
  }

  @Delete()
  async remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('deviceId') deviceId: unknown,
    @Query('platform') platform: unknown,
  ): Promise<{ deleted: boolean }> {
    const input = parseDeletePushTokenInput(deviceId, platform);
    const deleted = await this.tokenRepository.deleteForUser(
      currentUser.id,
      input.deviceId,
      input.platform,
    );

    return { deleted: deleted > 0 };
  }
}
