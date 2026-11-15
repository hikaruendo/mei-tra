import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  isLeaderboardMode,
  type LeaderboardResponse,
} from '@contracts/leaderboard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { ILeaderboardRepository } from '../repositories/interfaces/leaderboard.repository.interface';
import { AuthenticatedUser } from '../types/user.types';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(
    @Inject('ILeaderboardRepository')
    private readonly leaderboardRepository: ILeaderboardRepository,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  getWinRateLeaderboard(
    @Query('mode') mode: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaderboardResponse> {
    if (!isLeaderboardMode(mode)) {
      throw new BadRequestException('Invalid ranking mode');
    }
    return this.leaderboardRepository.getWinRateLeaderboard(mode, user.id);
  }
}
