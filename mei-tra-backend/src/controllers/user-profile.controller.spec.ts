import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserProfileController } from './user-profile.controller';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { SupabaseService } from '../database/supabase.service';
import { IGetUserRecentGameHistoryUseCase } from '../use-cases/interfaces/get-user-recent-game-history.use-case.interface';
import {
  AccountDeletionBlockedError,
  IDeleteAccountUseCase,
} from '../use-cases/interfaces/delete-account.use-case.interface';
import { RoomStatus } from '../types/room.types';

describe('UserProfileController', () => {
  const currentUser = {
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
        theme: 'dark' as const,
        fontSize: 'standard' as const,
      },
    },
  };

  const createController = (
    overrides: {
      deleteAccountUseCase?: IDeleteAccountUseCase;
      getUserRecentGameHistoryUseCase?: IGetUserRecentGameHistoryUseCase;
    } = {},
  ) =>
    new UserProfileController(
      {} as IUserProfileRepository,
      {} as SupabaseService,
      overrides.getUserRecentGameHistoryUseCase ?? { execute: jest.fn() },
      overrides.deleteAccountUseCase ?? { execute: jest.fn() },
    );

  it('returns the current user recent game history as DTOs', async () => {
    const getUserRecentGameHistoryUseCase: IGetUserRecentGameHistoryUseCase = {
      execute: jest.fn().mockResolvedValue([
        {
          roomId: 'room-1',
          roomName: 'Alpha room',
          completedAt: new Date('2026-04-16T01:00:00.000Z'),
          roundCount: 4,
          totalEntries: 18,
          teamNames: { 0: '111', 1: '222' },
          winningTeam: 1,
          lastActionType: 'game_over',
        },
      ]),
    };

    const controller = createController({ getUserRecentGameHistoryUseCase });

    await expect(
      controller.getRecentGameHistory('user-1', currentUser),
    ).resolves.toEqual([
      {
        roomId: 'room-1',
        roomName: 'Alpha room',
        completedAt: '2026-04-16T01:00:00.000Z',
        roundCount: 4,
        totalEntries: 18,
        teamNames: { 0: '111', 1: '222' },
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
    const controller = createController();

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

  it('deletes only the authenticated user account', async () => {
    const deleteAccountUseCase: IDeleteAccountUseCase = {
      execute: jest.fn().mockResolvedValue({
        deleted: true,
        cleanup: {
          anonymizedRoomPlayerCount: 1,
          anonymizedRoomCount: 1,
          anonymizedGameStateCount: 1,
          anonymizedGameHistoryCount: 2,
          removedAvatarObjectCount: 1,
        },
      }),
    };
    const controller = createController({ deleteAccountUseCase });

    await expect(
      controller.deleteAccount('user-1', currentUser),
    ).resolves.toEqual({
      deleted: true,
      cleanup: {
        anonymizedRoomPlayerCount: 1,
        anonymizedRoomCount: 1,
        anonymizedGameStateCount: 1,
        anonymizedGameHistoryCount: 2,
        removedAvatarObjectCount: 1,
      },
    });
    expect(deleteAccountUseCase.execute).toHaveBeenCalledWith('user-1');
  });

  it('rejects account deletion for another user', async () => {
    const deleteAccountUseCase: IDeleteAccountUseCase = {
      execute: jest.fn(),
    };
    const controller = createController({ deleteAccountUseCase });

    await expect(
      controller.deleteAccount('user-2', currentUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(deleteAccountUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns conflict when account still participates in active rooms', async () => {
    const deleteAccountUseCase: IDeleteAccountUseCase = {
      execute: jest.fn().mockRejectedValue(
        new AccountDeletionBlockedError([
          {
            roomId: 'room-1',
            status: RoomStatus.PLAYING,
            reason: 'participant',
          },
        ]),
      ),
    };
    const controller = createController({ deleteAccountUseCase });

    await expect(
      controller.deleteAccount('user-1', currentUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
