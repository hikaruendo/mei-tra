import { GameStateService } from '../game-state.service';
import { CardService } from '../card.service';
import { ChomboService } from '../chombo.service';
import { PlayService } from '../play.service';
import { IGameStateRepository } from '../../repositories/interfaces/game-state.repository.interface';

describe('GameStateService phase transitions', () => {
  let service: GameStateService;
  let repository: jest.Mocked<IGameStateRepository>;

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue(true),
      findByRoomId: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(true),
      updatePlayerConnection: jest.fn().mockResolvedValue(true),
      updateGamePhase: jest.fn().mockResolvedValue(true),
      updateCurrentPlayerIndex: jest.fn().mockResolvedValue(true),
      bulkUpdate: jest.fn().mockResolvedValue(true),
      updatePlayers: jest.fn().mockResolvedValue(true),
      deleteExpiredGameStates: jest.fn().mockResolvedValue(0),
    };

    service = new GameStateService(
      new CardService(),
      new ChomboService(new PlayService(new CardService())),
      repository,
    );
    service.setRoomId('room-1');
  });

  it('persists a legal transition', async () => {
    await service.transitionPhase('blow');

    expect(service.getState().gamePhase).toBe('blow');
    expect(repository.update).toHaveBeenCalledWith('room-1', {
      gamePhase: 'blow',
    });
  });

  it('rejects an illegal transition and keeps the previous phase', async () => {
    await service.transitionPhase('blow');

    await expect(service.transitionPhase('deal')).rejects.toThrow(
      'Invalid game phase transition: blow -> deal',
    );
    expect(service.getState().gamePhase).toBe('blow');
  });
});
