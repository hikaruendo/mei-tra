import { WatchRoomUseCase } from '../watch-room.use-case';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import {
  BlowState,
  DomainPlayer,
  GameState,
  Team,
} from '../../types/game.types';
import { TransportPlayer } from '../../types/player-adapters';
import { Room, RoomStatus } from '../../types/room.types';

describe('WatchRoomUseCase', () => {
  const player = (playerId: string, team: Team, hand: string[]) => ({
    socketId: `${playerId}-socket`,
    playerId,
    name: playerId,
    userId: playerId,
    isAuthenticated: true,
    team,
    hand,
    isPasser: false,
    isReady: true,
    isHost: playerId === 'p1',
    joinedAt: new Date(),
  });

  const room = (overrides: Partial<Room> = {}): Room => ({
    id: 'room-1',
    name: 'Room 1',
    hostId: 'p1',
    status: RoomStatus.PLAYING,
    players: [
      player('p1', 0, ['A♠', 'K♠']),
      player('p2', 1, ['A♥', 'K♥']),
      player('p3', 0, ['A♦', 'K♦']),
      player('p4', 1, ['A♣', 'K♣']),
    ],
    settings: {
      maxPlayers: 4,
      isPrivate: false,
      password: null,
      teamAssignmentMethod: 'random',
      pointsToWin: 5,
      allowSpectators: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
    ...overrides,
  });

  const blowState = (): BlowState => ({
    currentTrump: 'herz',
    currentHighestDeclaration: null,
    declarations: [],
    actionHistory: [],
    lastPasser: null,
    isRoundCancelled: false,
    currentBlowIndex: 0,
  });

  const gameState = (roomValue: Room): GameState => ({
    players: roomValue.players.map((roomPlayer) => ({
      playerId: roomPlayer.playerId,
      name: roomPlayer.name,
      team: roomPlayer.team,
      hand: [...roomPlayer.hand],
      isPasser: false,
      hasBroken: false,
      hasRequiredBroken: false,
    })),
    deck: [],
    currentPlayerIndex: 0,
    gamePhase: 'play',
    blowState: blowState(),
    playState: {
      currentField: null,
      negriCard: 'A♠',
      neguri: {},
      fields: [],
      lastWinnerId: null,
      openDeclared: false,
      openDeclarerId: null,
    },
    teamScores: {
      0: { play: 0, total: 0 },
      1: { play: 0, total: 0 },
    },
    teamScoreRecords: { 0: [], 1: [] },
    roundNumber: 1,
    pointsToWin: roomValue.settings.pointsToWin,
    teamAssignments: {},
  });

  const createUseCase = (roomValue: Room) => {
    const state = gameState(roomValue);
    const roomGameState = {
      getState: jest.fn(() => state),
      getTransportPlayers: jest.fn(
        (players: DomainPlayer[]): TransportPlayer[] =>
          players.map((domainPlayer) => ({
            socketId: `${domainPlayer.playerId}-socket`,
            playerId: domainPlayer.playerId,
            name: domainPlayer.name,
            userId: domainPlayer.playerId,
            isAuthenticated: true,
            team: domainPlayer.team,
            hand: [...domainPlayer.hand],
            isPasser: domainPlayer.isPasser,
          })),
      ),
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(roomValue),
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
    } as Partial<IRoomService> as IRoomService;

    return new WatchRoomUseCase(roomService);
  };

  it('returns a spectator snapshot with all hands visible', async () => {
    const roomValue = room();
    const useCase = createUseCase(roomValue);

    const result = await useCase.execute({ roomId: roomValue.id });

    expect(result.success).toBe(true);
    expect(result.data?.gameState.isSpectator).toBe(true);
    expect(result.data?.gameState.you).toBeNull();
    expect(result.data?.gameState.negriCard).toBe('A♠');
    expect(result.data?.gameState.players.map((p) => p.hand)).toEqual([
      ['A♠', 'K♠'],
      ['A♥', 'K♥'],
      ['A♦', 'K♦'],
      ['A♣', 'K♣'],
    ]);
  });

  it('rejects rooms that do not allow spectators', async () => {
    const roomValue = room({
      settings: {
        ...room().settings,
        allowSpectators: false,
      },
    });
    const useCase = createUseCase(roomValue);

    await expect(useCase.execute({ roomId: roomValue.id })).resolves.toEqual({
      success: false,
      error: 'Spectators are not allowed',
    });
  });
});
