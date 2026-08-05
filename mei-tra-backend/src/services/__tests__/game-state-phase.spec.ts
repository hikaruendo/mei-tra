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
      update: jest.fn().mockResolvedValue({ version: 1 }),
      persistRoomRoster: jest.fn().mockResolvedValue({ version: 1 }),
      delete: jest.fn().mockResolvedValue(true),
      updatePlayerConnection: jest.fn().mockResolvedValue(true),
      updateGamePhase: jest.fn().mockResolvedValue(true),
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists a legal transition', async () => {
    await service.transitionPhase('blow');

    expect(service.getState().gamePhase).toBe('blow');
    expect(repository.update).toHaveBeenCalledWith(
      'room-1',
      { gamePhase: 'blow' },
      0,
    );
  });

  it('rejects an illegal transition and keeps the previous phase', async () => {
    await service.transitionPhase('blow');

    await expect(service.transitionPhase('deal')).rejects.toThrow(
      'Invalid game phase transition: blow -> deal',
    );
    expect(service.getState().gamePhase).toBe('blow');
  });

  it('serializes concurrent persistence with the latest version', async () => {
    const expectedVersions: Array<number | undefined> = [];
    repository.update.mockImplementation(
      async (_roomId, updates, expectedVersion) => {
        expectedVersions.push(expectedVersion);
        return {
          ...service.getState(),
          ...updates,
          version: (expectedVersion ?? 0) + 1,
        };
      },
    );

    await Promise.all([service.saveState(), service.saveState()]);

    expect(expectedVersions).toEqual([0, 1]);
    expect(service.getState().version).toBe(2);
  });

  it('keeps the persisted version when resetting a round', async () => {
    const state = service.getState();
    state.version = 96;
    state.teamAssignments = { 'player-1': 0 };

    await service.resetRoundState();
    expect(service.getState().version).toBe(96);
    expect(service.getState().teamAssignments).toEqual({ 'player-1': 0 });

    await service.saveState();

    expect(repository.update).toHaveBeenCalledWith(
      'room-1',
      expect.any(Object),
      96,
    );
  });

  it('persists round changes through an explicit state update', async () => {
    const state = service.getState();
    state.version = 96;

    await service.updateState({ roundNumber: 2 });

    expect(repository.update).toHaveBeenCalledWith(
      'room-1',
      { roundNumber: 2 },
      96,
    );
  });

  it('records a completed field without persisting an intermediate snapshot', () => {
    const state = service.getState();
    state.players = [
      {
        playerId: 'player-1',
        name: 'Player 1',
        team: 0,
        hand: [],
        isPasser: false,
      },
    ];
    const currentField = {
      cards: ['S1', 'S2', 'S3', 'S4'],
      playedBy: ['player-1', 'player-2', 'player-3', 'player-4'],
      baseCard: 'S1',
      dealerId: 'player-1',
      isComplete: true,
    };
    state.playState = {
      currentField,
      negriCard: null,
      neguri: {},
      fields: [],
      lastWinnerId: null,
      openDeclared: false,
      openDeclarerId: null,
    };

    const completedField = service.completeField(currentField, 'player-1');

    expect(completedField).toEqual(
      expect.objectContaining({ winnerId: 'player-1', winnerTeam: 0 }),
    );
    expect(state.playState.fields).toHaveLength(1);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('selects the initial blow player at random instead of the host seat', async () => {
    repository.update.mockImplementation(
      async (_roomId, updates, expectedVersion) => ({
        ...service.getState(),
        ...updates,
        version: (expectedVersion ?? 0) + 1,
      }),
    );
    const state = service.getState();
    state.players = [
      {
        playerId: 'host-player',
        name: 'Host',
        team: 0,
        hand: [],
        isPasser: false,
      },
      {
        playerId: 'player-2',
        name: 'Player 2',
        team: 1,
        hand: [],
        isPasser: false,
      },
      {
        playerId: 'player-3',
        name: 'Player 3',
        team: 0,
        hand: [],
        isPasser: false,
      },
      {
        playerId: 'player-4',
        name: 'Player 4',
        team: 1,
        hand: [],
        isPasser: false,
      },
    ];
    jest.spyOn(Math, 'random').mockReturnValue(0.6);

    await service.startGame();

    const startedState = service.getState();
    expect(startedState.currentPlayerIndex).toBe(2);
    expect(startedState.players[startedState.currentPlayerIndex].playerId).toBe(
      'player-3',
    );
    expect(startedState.blowState.currentBlowIndex).toBe(2);
  });
});
