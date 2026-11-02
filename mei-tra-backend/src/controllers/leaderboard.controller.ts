import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  LeaderboardMode,
  LeaderboardResponse,
} from '@contracts/leaderboard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { ILeaderboardRepository } from '../repositories/interfaces/leaderboard.repository.interface';
import { AuthenticatedUser } from '../types/user.types';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(
    @Inject('ILeaderboardRepository')
    private readonly repository: ILeaderboardRepository,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  get(
    @Query('mode') mode: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaderboardResponse> {
    if (mode !== 'normal' && mode !== 'pro') {
      throw new BadRequestException('Invalid ranking mode');
    }
    return this.repository.get(mode as LeaderboardMode, user.id);
  }
}
