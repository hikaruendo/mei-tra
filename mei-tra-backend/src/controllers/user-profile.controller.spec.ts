import { ForbiddenException } from '@nestjs/common';
import { UserProfileController } from './user-profile.controller';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { SupabaseService } from '../database/supabase.service';
import { IGetUserRecentGameHistoryUseCase } from '../use-cases/interfaces/get-user-recent-game-history.use-case.interface';

describe('UserProfileController', () => {
  it('returns the current user recent game history as DTOs', async () => {
    const userProfileRepository = {} as IUserProfileRepository;
    const supabaseService = {} as SupabaseService;
    const getUserRecentGameHistoryUseCase: IGetUserRecentGameHistoryUseCase = {
      execute: jest.fn().mockResolvedValue([
        {
          roomId: 'room-1',
          roomName: 'Alpha room',
          completedAt: new Date('2026-04-16T01:00:00.000Z'),
          roundCount: 4,
          totalEntries: 18,
          winningTeam: 1,
          lastActionType: 'game_over',
        },
      ]),
    };

    const controller = new UserProfileController(
      userProfileRepository,
      supabaseService,
      getUserRecentGameHistoryUseCase,
    );

    await expect(
      controller.getRecentGameHistory('user-1', {
        id: 'user-1',
        email: 'user@example.com',
        profile: {
          id: 'user-1',
          username: 'user',
          displayName: 'User',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-01T00:00:00.000Z'),
          lastSeenAt: new Date('2026-04-01T00:00:00.000Z'),
          gamesPlayed: 1,
          gamesWon: 1,
          totalScore: 10,
          preferences: {
            notifications: true,
            sound: true,
            theme: 'dark',
            fontSize: 'standard',
          },
        },
      }),
    ).resolves.toEqual([
      {
        roomId: 'room-1',
        roomName: 'Alpha room',
        completedAt: '2026-04-16T01:00:00.000Z',
        roundCount: 4,
        totalEntries: 18,
        winningTeam: 1,
        lastActionType: 'game_over',
      },
    ]);

    expect(getUserRecentGameHistoryUseCase.execute).toHaveBeenCalledWith(
      'user-1',
      10,
    );
  });

  it('rejects requests for another user recent game history', async () => {
    const controller = new UserProfileController(
      {} as IUserProfileRepository,
      {} as SupabaseService,
      { execute: jest.fn() },
    );

    await expect(
      controller.getRecentGameHistory('user-1', {
        id: 'user-2',
        email: 'other@example.com',
        profile: {
          id: 'user-2',
          username: 'other',
          displayName: 'Other',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-01T00:00:00.000Z'),
          lastSeenAt: new Date('2026-04-01T00:00:00.000Z'),
          gamesPlayed: 1,
          gamesWon: 0,
          totalScore: 0,
          preferences: {
            notifications: true,
            sound: true,
            theme: 'dark',
            fontSize: 'standard',
          },
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
