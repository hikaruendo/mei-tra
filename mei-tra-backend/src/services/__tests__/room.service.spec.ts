import { RoomService } from '../room.service';
import { Room, RoomPlayer, RoomStatus } from '../../types/room.types';
import { DomainPlayer, Team } from '../../types/game.types';
import { VacantSeats } from '../com-session.service';

const createRoomPlayer = (overrides: Partial<RoomPlayer> = {}): RoomPlayer => ({
  socketId: 'socket-1',
  playerId: 'player-1',
  userId: 'user-1',
  name: 'Player 1',
  team: 0,
  hand: [],
  isPasser: false,
  hasBroken: false,
  hasRequiredBroken: false,
  isReady: false,
  isHost: true,
  isCOM: false,
  isAuthenticated: true,
  joinedAt: new Date('2026-04-01T00:00:00.000Z'),
  ...overrides,
});

const createRoom = (): Room => ({
  id: 'room-1',
  name: 'Room',
  hostId: 'player-1',
  status: RoomStatus.WAITING,
  players: [createRoomPlayer()],
  settings: {
    maxPlayers: 4,
    isPrivate: false,
    password: null,
    teamAssignmentMethod: 'random',
    pointsToWin: 5,
    allowSpectators: true,
  },
  createdAt: new Date('2026-04-01T00:00:00.000Z'),
  updatedAt: new Date('2026-04-01T00:00:00.000Z'),
  lastActivityAt: new Date('2026-04-01T00:00:00.000Z'),
});

interface TestGameState {
  setRoomId: jest.Mock;
  loadState: jest.Mock<Promise<void>, [string]>;
  getState: jest.Mock<
    {
      players: DomainPlayer[];
      teamAssignments: Record<string, Team>;
      gamePhase: null;
    },
    []
  >;
}

interface TestJoinRoomParams {
  room: Room;
  gameState: TestGameState;
  vacantSeats: VacantSeats;
}

const createGameState = (): TestGameState => {
  const state: {
    players: DomainPlayer[];
    teamAssignments: Record<string, Team>;
    gamePhase: null;
  } = {
    players: [],
    teamAssignments: {},
    gamePhase: null,
  };

  return {
    setRoomId: jest.fn(),
    loadState: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    getState: jest.fn(() => state),
  };
};

describe('RoomService join rollback', () => {
  it('reloads cached game state and restores vacant seats when join persistence rejects', async () => {
    const room = createRoom();
    const roomRepository = {
      findById: jest.fn().mockResolvedValue(room),
      findAll: jest.fn().mockResolvedValue([]),
    };
    const initialGameState = createGameState();
    const reloadedGameState = createGameState();
    const gameStateFactory = {
      createGameState: jest
        .fn()
        .mockReturnValueOnce(initialGameState)
        .mockReturnValueOnce(reloadedGameState),
    };
    const roomJoinService = {
      joinRoom: jest.fn(
        async ({
          room: mutableRoom,
          gameState,
          vacantSeats,
        }: TestJoinRoomParams) => {
          mutableRoom.players.push(
            createRoomPlayer({
              socketId: 'ghost-socket',
              playerId: 'ghost-player',
              userId: 'ghost-user',
              name: 'Ghost',
              isHost: false,
              team: 1 as Team,
            }),
          );
          gameState.getState().players.push({
            playerId: 'ghost-player',
            name: 'Ghost',
            hand: [],
            team: 1,
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          });
          vacantSeats['room-1'] = {};
          throw new Error('account_deletion_in_progress user=ghost-user');
        },
      ),
    };
    const service = new RoomService(
      roomRepository as never,
      {} as never,
      gameStateFactory as never,
      {} as never,
      {
        claim: jest.fn().mockResolvedValue(null),
        get: jest.fn().mockResolvedValue(null),
      } as never,
      undefined,
      undefined,
      undefined,
      undefined,
      roomJoinService as never,
    );
    const originalVacantSeat = createRoomPlayer({
      playerId: 'vacant-player',
      userId: 'vacant-user',
      socketId: '',
      name: 'Vacant',
      isHost: false,
    });
    (
      service as unknown as { vacantSeats: Record<string, unknown> }
    ).vacantSeats['room-1'] = {
      2: {
        roomPlayer: originalVacantSeat,
      },
    };

    await expect(
      service.joinRoom('room-1', {
        socketId: 'socket-2',
        playerId: 'user-2',
        userId: 'user-2',
        name: 'Player 2',
        isAuthenticated: true,
      }),
    ).resolves.toBe(false);

    const internals = service as unknown as {
      roomGameStates: Map<string, unknown>;
      vacantSeats: Record<string, Record<number, { roomPlayer: RoomPlayer }>>;
    };
    expect(internals.roomGameStates.get('room-1')).toBe(reloadedGameState);
    expect(internals.vacantSeats['room-1'][2].roomPlayer).toMatchObject({
      playerId: 'vacant-player',
      userId: 'vacant-user',
    });
    expect(internals.vacantSeats['room-1'][2].roomPlayer).not.toBe(
      originalVacantSeat,
    );
    expect(reloadedGameState.loadState).toHaveBeenCalledWith('room-1');
    expect(gameStateFactory.createGameState).toHaveBeenCalledTimes(2);

    service.onModuleDestroy();
  });
});
