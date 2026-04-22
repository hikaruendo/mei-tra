import { Inject, Injectable, Logger } from '@nestjs/common';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';

@Injectable()
export class UserGameStatsService {
  private readonly logger = new Logger(UserGameStatsService.name);

  constructor(
    @Inject('IUserProfileRepository')
    private readonly userProfileRepository: IUserProfileRepository,
  ) {}

  async updateUserGameStats(
    userId: string,
    won: boolean,
    score: number,
  ): Promise<void> {
    try {
      const profile = await this.userProfileRepository.findById(userId);
      if (!profile) {
        this.logger.warn(`User profile not found for user ${userId}`);
        throw new Error(`User profile not found for user ${userId}`);
      }

      await this.userProfileRepository.updateGameStats(
        userId,
        profile.gamesPlayed + 1,
        won ? profile.gamesWon + 1 : profile.gamesWon,
        profile.totalScore + score,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update game stats for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    try {
      await this.userProfileRepository.updateLastSeen(userId);
    } catch (error) {
      this.logger.error(
        `Failed to update last seen for user ${userId}:`,
        error,
      );
    }
  }
}
