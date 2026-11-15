import { BadRequestException } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { ILeaderboardRepository } from '../repositories/interfaces/leaderboard.repository.interface';
import { AuthenticatedUser } from '../types/user.types';

describe('LeaderboardController', () => {
  const user = { id: 'user-1' } as AuthenticatedUser;
  let repository: jest.Mocked<ILeaderboardRepository>;
  let controller: LeaderboardController;

  beforeEach(() => {
    repository = {
      getWinRateLeaderboard: jest.fn().mockResolvedValue({
        mode: 'pro',
        minimumGames: 10,
        entries: [],
        me: null,
      }),
    };
    controller = new LeaderboardController(repository);
  });

  it('reads the requested mode for the signed-in viewer', async () => {
    await controller.getWinRateLeaderboard('pro', user);

    expect(repository.getWinRateLeaderboard).toHaveBeenCalledWith(
      'pro',
      'user-1',
    );
  });

  it.each([undefined, '', 'expert', ['pro']])(
    'rejects an unknown mode: %j',
    (mode) => {
      expect(() => controller.getWinRateLeaderboard(mode, user)).toThrow(
        BadRequestException,
      );
      expect(repository.getWinRateLeaderboard).not.toHaveBeenCalled();
    },
  );
});
