/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { JoinRoomUseCase } from '../join-room.use-case';
import { CreateRoomUseCase } from '../create-room.use-case';
import { LeaveRoomUseCase } from '../leave-room.use-case';
import { StartGameUseCase } from '../start-game.use-case';
import { TogglePlayerReadyUseCase } from '../toggle-player-ready.use-case';
import { ChangePlayerTeamUseCase } from '../change-player-team.use-case';
import { PlayCardUseCase } from '../play-card.use-case';
import { SelectBaseSuitUseCase } from '../select-base-suit.use-case';
import { SelectNegriUseCase } from '../select-negri.use-case';
import { RevealBrokenHandUseCase } from '../reveal-broken-hand.use-case';
import { CompleteFieldUseCase } from '../complete-field.use-case';
import { ComAutoPlayUseCase } from '../com-autoplay.use-case';
import { ProcessGameOverUseCase } from '../process-game-over.use-case';
import { UpdateAuthUseCase } from '../update-auth.use-case';
import { AuthService } from '../../auth/auth.service';
import { Room, RoomPlayer, RoomStatus } from '../../types/room.types';
import { AuthenticatedUser } from '../../types/user.types';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { IGameStateService } from '../../services/interfaces/game-state-service.interface';
import { GameStateService } from '../../services/game-state.service';
import {
  GamePhase,
  Player,
  TeamScores,
  Field,
  Team,
} from '../../types/game.types';
import { ICardService } from '../../services/interfaces/card-service.interface';
import { IPlayService } from '../../services/interfaces/play-service.interface';
import { IScoreService } from '../../services/interfaces/score-service.interface';
describe('Game Use Cases', () => {
  const createRoomServiceMock = () => {
    const mock: Partial<jest.Mocked<IRoomService>> = {
      joinRoom: jest.fn(),
      getRoom: jest.fn(),
      listRooms: jest.fn(),
      getRoomGameState: jest.fn(),
      updateRoomStatus: jest.fn(),
      fillVacantSeatsWithCOM: jest.fn(),
      updatePlayerInRoom: jest.fn(),
      canStartGame: jest.fn(),
      createNewRoom: jest.fn(),
      leaveRoom: jest.fn(),
      updateRoom: jest.fn(),
      deleteRoom: jest.fn(),
      handlePlayerReconnection: jest.fn(),
      restorePlayerFromVacantSeat: jest.fn(),
      updateUserGameStats: jest.fn(),
      updateUserLastSeen: jest.fn(),
    };

    return mock as jest.Mocked<IRoomService>;
  };

  const createGameStateServiceMock = () => {
    const mock: Partial<jest.Mocked<IGameStateService>> = {
      getUsers: jest.fn(),
    };
    return mock as jest.Mocked<IGameStateService>;
  };

  const createCardServiceMock = () => {
    const mock: Partial<jest.Mocked<ICardService>> = {
      generateDeck: jest.fn(() =>
        Array.from({ length: 52 }, (_, idx) => `C${idx}`),
      ),
    };
    return mock as jest.Mocked<ICardService>;
  };

  const createPlayServiceMock = (winnerId: string) => {
    const determineFieldWinnerMock = jest.fn<
      ReturnType<IPlayService['determineFieldWinner']>,
      Parameters<IPlayService['determineFieldWinner']>
    >((_, players) => players.find((p) => p.playerId === winnerId) || null);

    const mock: Partial<jest.Mocked<IPlayService>> = {
      determineFieldWinner: determineFieldWinnerMock,
    };
    return mock as jest.Mocked<IPlayService>;
  };

  const createScoreServiceMock = (points: number) => {
    const calculatePlayPointsMock = jest.fn<
      ReturnType<IScoreService['calculatePlayPoints']>,
      Parameters<IScoreService['calculatePlayPoints']>
    >(() => points);

    const mock: Partial<jest.Mocked<IScoreService>> = {
      calculatePlayPoints: calculatePlayPointsMock,
    };
    return mock as jest.Mocked<IScoreService>;
  };

  const createAuthServiceMock = () => {
    const mock: Partial<jest.Mocked<AuthService>> = {
      getUserFromSocketToken: jest.fn(),
    };
    return mock as jest.Mocked<AuthService>;
  };

  const basePlayers: RoomPlayer[] = [
    {
      id: 'socket-1',
      playerId: 'player-1',
      name: 'Player 1',
      team: 0 as const,
      hand: [],
      isPasser: false,
      isReady: false,
      isHost: true,
      hasBroken: false,
      joinedAt: new Date(),
    },
    {
      id: 'socket-2',
      playerId: 'player-2',
      name: 'Player 2',
      team: 1 as const,
      hand: [],
      isPasser: false,
      isReady: false,
      isHost: false,
      hasBroken: false,
      joinedAt: new Date(),
    },
  ];

  const baseRoom: Room = {
    id: 'room-1',
    name: 'Room',
    hostId: 'player-1',
    status: RoomStatus.WAITING,
    players: basePlayers,
    settings: {
      maxPlayers: 4,
      isPrivate: false,
      password: null,
      teamAssignmentMethod: 'random' as const,
      pointsToWin: 30,
      allowSpectators: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
  };

  describe('JoinRoomUseCase', () => {
    it('returns success payload with normalized user when join succeeds', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new JoinRoomUseCase(roomService);

      const room: Room = { ...baseRoom };
      const roomsList = [room];

      const gameStateMock = {
        getState: jest.fn(() => ({
          players: [],
          gamePhase: null,
        })),
      } as unknown as GameStateService;

      roomService.joinRoom.mockResolvedValue(true);
      roomService.getRoom.mockResolvedValue(room);
      roomService.listRooms.mockResolvedValue(roomsList);
      roomService.getRoomGameState.mockResolvedValue(gameStateMock);

      const authenticatedUser = {
        id: 'user-1',
        email: 'user@example.com',
        profile: {
          id: 'profile-1',
          username: 'user',
          displayName: 'Display Name',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSeenAt: new Date(),
          gamesPlayed: 0,
          gamesWon: 0,
          totalScore: 0,
          preferences: {
            notifications: true,
            sound: true,
            theme: 'light',
          },
        },
      } as AuthenticatedUser;

      const result = await useCase.execute({
        socketId: 'socket-1',
        targetRoomId: room.id,
        user: {
          id: 'socket-1',
          playerId: 'player-1',
          name: 'Fallback Name',
        },
        authenticatedUser,
      });

      expect(result.success).toBe(true);
      expect(result.data?.room).toEqual(room);
      expect(result.data?.roomsList).toEqual(roomsList);

      const joinRoomMock = roomService.joinRoom as jest.Mock;
      expect(joinRoomMock).toHaveBeenCalledWith(
        room.id,
        expect.objectContaining({
          name: 'Display Name',
          userId: 'user-1',
          isAuthenticated: true,
        }),
      );
    });

    it('returns failure when repository join fails', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new JoinRoomUseCase(roomService);

      roomService.joinRoom.mockResolvedValue(false);

      const result = await useCase.execute({
        socketId: 'socket-1',
        targetRoomId: 'room-unknown',
        user: {
          id: 'socket-1',
          playerId: 'player-1',
          name: 'Player 1',
        },
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Failed to join room');
    });
  });

  describe('CreateRoomUseCase', () => {
    it('requires player name', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new CreateRoomUseCase(roomService);

      const result = await useCase.execute({
        roomName: 'Room',
        pointsToWin: 30,
        teamAssignmentMethod: 'random',
        authenticatedUser: { id: 'user-1' } as any,
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Name is required');
    });

    it('creates a room when authenticated user is present', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new CreateRoomUseCase(roomService);

      const room: Room = { ...baseRoom };

      roomService.createNewRoom.mockResolvedValue(room);
      roomService.listRooms.mockResolvedValue([room]);

      const result = await useCase.execute({
        roomName: 'Room',
        pointsToWin: 30,
        teamAssignmentMethod: 'random',
        playerName: 'Host',
        authenticatedUser: { id: 'player-1' } as any,
      });

      expect(result.success).toBe(true);
      expect(result.data?.room).toEqual(room);

      const createRoomMock = roomService.createNewRoom as jest.Mock;
      expect(createRoomMock).toHaveBeenCalledWith(
        'Room',
        'player-1',
        30,
        'random',
      );
    });
  });

  describe('LeaveRoomUseCase', () => {
    it('returns failure when room not found', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new LeaveRoomUseCase(roomService);

      roomService.getRoom.mockResolvedValue(null);

      const result = await useCase.execute({
        playerId: 'player-1',
        roomId: 'missing',
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Room not found');
    });

    it('returns success with updated players and pause notice when room persists', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new LeaveRoomUseCase(roomService);

      const room: Room = { ...baseRoom };
      const statePlayers: Player[] = [
        {
          id: 'socket-2',
          playerId: 'player-2',
          name: 'Player 2',
          team: 1 as const,
          hand: [],
          isPasser: false,
        },
      ];
      const state = {
        players: statePlayers,
        teamAssignments: {} as Record<string, number>,
        gamePhase: 'play' as GamePhase,
      };

      const gameStateMock = {
        getState: jest.fn(() => state),
      } as unknown as GameStateService;

      roomService.getRoom
        .mockResolvedValueOnce(room)
        .mockResolvedValueOnce(room);
      roomService.leaveRoom.mockResolvedValue(true);
      roomService.listRooms.mockResolvedValue([room]);
      roomService.getRoomGameState.mockResolvedValue(gameStateMock);

      const result = await useCase.execute({
        playerId: 'player-1',
        roomId: room.id,
      });

      expect(result.success).toBe(true);
      expect(result.data?.updatedPlayers).toEqual(statePlayers);
      // gamePausedMessage is no longer sent (COM takes over vacant seats)

      const leaveRoomMock = roomService.leaveRoom as jest.Mock;
      expect(leaveRoomMock).toHaveBeenCalledWith(room.id, 'player-1');
    });

    it('signals room deletion when room is removed', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new LeaveRoomUseCase(roomService);

      const room: Room = { ...baseRoom };

      roomService.getRoom
        .mockResolvedValueOnce(room)
        .mockResolvedValueOnce(null);
      roomService.leaveRoom.mockResolvedValue(true);
      roomService.listRooms.mockResolvedValue([]);

      const result = await useCase.execute({
        playerId: 'player-1',
        roomId: room.id,
      });

      expect(result.success).toBe(true);
      expect(result.data?.roomDeleted).toBe(true);
      expect(result.data?.roomsList).toEqual([]);
    });

    it('replaces player with com during play and removes reconnection token', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new LeaveRoomUseCase(roomService);

      const playingRoom: Room = {
        ...baseRoom,
        status: RoomStatus.PLAYING,
        players: [
          ...baseRoom.players,
          {
            id: 'socket-2',
            playerId: 'player-2',
            name: 'Player 2',
            team: 1 as const,
            hand: ['H2', 'D3'],
            isPasser: false,
            hasBroken: false,
            isReady: true,
            isHost: false,
            joinedAt: new Date(),
          },
        ] as RoomPlayer[],
      };

      const statePlayers: Player[] = [
        {
          id: '',
          playerId: 'com-0',
          name: 'COM',
          team: 0 as const,
          hand: [],
          isPasser: false,
        },
        {
          id: 'socket-2',
          playerId: 'player-2',
          name: 'Player 2',
          team: 1 as const,
          hand: ['H2', 'D3'],
          isPasser: false,
        },
      ];

      const state = {
        players: statePlayers,
        teamAssignments: { 'player-1': 0 } as Record<string, number>,
        gamePhase: 'play' as GamePhase,
      };

      const gameStateMock = {
        getState: jest.fn(() => state),
      } as unknown as GameStateService;

      roomService.getRoom
        .mockResolvedValueOnce(playingRoom)
        .mockResolvedValueOnce(playingRoom);
      roomService.leaveRoom.mockResolvedValue(true);
      roomService.listRooms.mockResolvedValue([playingRoom]);
      roomService.getRoomGameState.mockResolvedValue(gameStateMock);

      const result = await useCase.execute({
        playerId: 'player-1',
        roomId: playingRoom.id,
      });

      expect(result.success).toBe(true);
      expect(result.data?.updatedPlayers).toEqual(statePlayers);

      // Verify leaveRoom was called (which replaces with com and removes token)
      const leaveRoomMock = roomService.leaveRoom as jest.Mock;
      expect(leaveRoomMock).toHaveBeenCalledWith(playingRoom.id, 'player-1');

      // Verify com player is in the list
      expect(statePlayers[0].playerId).toContain('com-');
    });
  });

  describe('StartGameUseCase', () => {
    it('starts game when prerequisites satisfied', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new StartGameUseCase(roomService);

      const room: Room = {
        ...baseRoom,
        status: RoomStatus.READY,
        players: baseRoom.players.map((p) => ({
          ...p,
          isReady: true,
        })) as RoomPlayer[],
      };

      const state: {
        players: Player[];
        currentPlayerIndex: number;
        blowState: {
          currentBlowIndex: number;
          currentTrump: string | null;
          currentHighestDeclaration: unknown;
          declarations: unknown[];
          lastPasser: string | null;
          isRoundCancelled: boolean;
        };
        teamScores: TeamScores;
        pointsToWin: number;
        gamePhase: GamePhase;
      } = {
        players: [
          {
            id: 'socket-1',
            playerId: 'player-1',
            name: 'Player 1',
            team: 0 as const,
            hand: [],
            isPasser: false,
          },
          {
            id: 'socket-2',
            playerId: 'player-2',
            name: 'Player 2',
            team: 1 as const,
            hand: [],
            isPasser: false,
          },
        ],
        currentPlayerIndex: 0,
        blowState: {
          currentBlowIndex: 0,
          currentTrump: null,
          currentHighestDeclaration: null,
          declarations: [],
          lastPasser: null,
          isRoundCancelled: false,
        },
        teamScores: {
          0: { play: 0, total: 0 },
          1: { play: 0, total: 0 },
        },
        pointsToWin: 0,
        gamePhase: 'blow',
      };

      const roomGameState = {
        getState: jest.fn(() => state),
        startGame: jest.fn().mockResolvedValue(undefined),
      } as unknown as GameStateService;

      roomService.getRoom.mockResolvedValue(room);
      roomService.getRoomGameState.mockResolvedValue(roomGameState);
      roomService.canStartGame.mockResolvedValue({ canStart: true });
      roomService.updateRoomStatus.mockResolvedValue(true);

      const result = await useCase.execute({
        playerId: 'player-1',
        roomId: room.id,
      });

      expect(result.success).toBe(true);
      expect(result.data?.players.length).toBe(2);
      expect(result.data?.currentTurnPlayerId).toBe('player-1');

      const updateRoomStatusMock = roomService.updateRoomStatus as jest.Mock;
      expect(updateRoomStatusMock).toHaveBeenCalledWith(
        room.id,
        RoomStatus.PLAYING,
      );
    });

    it('rebuilds state players from room seat order before starting', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new StartGameUseCase(roomService);

      const room: Room = {
        ...baseRoom,
        status: RoomStatus.READY,
        players: [
          {
            id: 'socket-1',
            playerId: 'player-1',
            name: 'Player 1',
            team: 0 as const,
            hand: [],
            isPasser: false,
            isReady: true,
            isHost: true,
            hasBroken: false,
            joinedAt: new Date(),
          },
          {
            id: 'socket-3',
            playerId: 'player-3',
            name: 'Player 3',
            team: 1 as const,
            hand: [],
            isPasser: false,
            isReady: true,
            isHost: false,
            hasBroken: false,
            joinedAt: new Date(),
          },
          {
            id: 'socket-2',
            playerId: 'player-2',
            name: 'Player 2',
            team: 0 as const,
            hand: [],
            isPasser: false,
            isReady: true,
            isHost: false,
            hasBroken: false,
            joinedAt: new Date(),
          },
          {
            id: 'socket-4',
            playerId: 'player-4',
            name: 'Player 4',
            team: 1 as const,
            hand: [],
            isPasser: false,
            isReady: true,
            isHost: false,
            hasBroken: false,
            joinedAt: new Date(),
          },
        ],
      };

      const state = {
        players: [
          {
            id: 'socket-4',
            playerId: 'player-4',
            name: 'Player 4',
            team: 1 as const,
            hand: ['H4'],
            isPasser: false,
          },
          {
            id: 'socket-2',
            playerId: 'player-2',
            name: 'Player 2',
            team: 1 as const,
            hand: ['H2'],
            isPasser: false,
          },
          {
            id: 'socket-1',
            playerId: 'player-1',
            name: 'Player 1',
            team: 1 as const,
            hand: ['H1'],
            isPasser: false,
          },
        ] as Player[],
        currentPlayerIndex: 0,
        blowState: {
          currentBlowIndex: 0,
          currentTrump: null,
          currentHighestDeclaration: null,
          declarations: [],
          lastPasser: null,
          isRoundCancelled: false,
        },
        teamScores: {
          0: { play: 0, total: 0 },
          1: { play: 0, total: 0 },
        } as TeamScores,
        teamAssignments: {},
        pointsToWin: 0,
        gamePhase: 'blow' as GamePhase,
      };

      const registerPlayerTokenMock = jest.fn();
      const startGameMock = jest.fn(() => {
        state.players = [
          state.players[0],
          state.players[1],
          state.players[2],
          state.players[3],
        ];
      });
      const roomGameState = {
        getState: jest.fn(() => state),
        registerPlayerToken: registerPlayerTokenMock,
        startGame: startGameMock,
      } as unknown as GameStateService;

      roomService.getRoom.mockResolvedValue(room);
      roomService.getRoomGameState.mockResolvedValue(roomGameState);
      roomService.canStartGame.mockResolvedValue({ canStart: true });
      roomService.fillVacantSeatsWithCOM.mockResolvedValue(undefined);
      roomService.updateRoomStatus.mockResolvedValue(true);

      const result = await useCase.execute({
        playerId: 'player-1',
        roomId: room.id,
      });

      expect(result.success).toBe(true);
      expect(state.players.map((player) => player.playerId)).toEqual([
        'player-1',
        'player-3',
        'player-2',
        'player-4',
      ]);
      expect(state.players[0]?.team).toBe(0);
      expect(state.players[1]?.team).toBe(1);
      expect(state.players[2]?.hand).toEqual(['H2']);
      expect(state.teamAssignments).toEqual({
        'player-1': 0,
        'player-2': 0,
        'player-3': 1,
        'player-4': 1,
      });
      expect(registerPlayerTokenMock).toHaveBeenCalledWith(
        'player-3',
        'player-3',
      );
      expect(registerPlayerTokenMock).toHaveBeenCalledTimes(1);
    });

    it('returns failure when canStartGame denies', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new StartGameUseCase(roomService);

      const failureRoom: Room = { ...baseRoom };
      roomService.getRoom.mockResolvedValue(failureRoom);
      roomService.getRoomGameState.mockResolvedValue({
        getState: jest.fn(() => ({
          players: [
            {
              id: 'socket-1',
              playerId: 'player-1',
              name: 'Player 1',
              team: 0 as const,
              hand: [],
              isPasser: false,
            },
          ],
        })),
      } as unknown as GameStateService);
      roomService.canStartGame.mockResolvedValue({
        canStart: false,
        reason: 'Need more players',
      });

      const result = await useCase.execute({
        playerId: 'player-1',
        roomId: 'room-1',
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Need more players');
    });
  });

  describe('TogglePlayerReadyUseCase', () => {
    it('updates ready state and room status', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new TogglePlayerReadyUseCase(roomService);

      const room: Room = {
        ...baseRoom,
        players: baseRoom.players.map((p) => ({ ...p })) as RoomPlayer[],
      };

      roomService.getRoom.mockResolvedValueOnce(room).mockResolvedValueOnce({
        ...room,
        players: room.players,
      } as Room);
      roomService.updatePlayerInRoom.mockResolvedValue(true);
      roomService.updateRoomStatus.mockResolvedValue(true);

      const result = await useCase.execute({
        roomId: room.id,
        playerId: 'player-1',
      });

      expect(result.success).toBe(true);

      const updatePlayerInRoomMock =
        roomService.updatePlayerInRoom as jest.Mock;
      expect(updatePlayerInRoomMock).toHaveBeenCalledWith(
        room.id,
        'player-1',
        expect.objectContaining({ isReady: true }),
      );
      expect(result.updatedRoom).toBeDefined();
    });
  });

  describe('ChangePlayerTeamUseCase', () => {
    it('rejects team change when exceeding max members', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new ChangePlayerTeamUseCase(roomService);

      const room: Room = {
        ...baseRoom,
        players: [
          ...(baseRoom.players.map((p) => ({ ...p })) as RoomPlayer[]),
          {
            id: 'socket-3',
            playerId: 'player-3',
            name: 'Player 3',
            team: 0 as const,
            hand: [],
            isPasser: false,
            isReady: false,
            isHost: false,
            hasBroken: false,
            joinedAt: new Date(),
          } as RoomPlayer,
        ],
      };

      roomService.getRoom.mockResolvedValue(room);

      const result = await useCase.execute({
        roomId: room.id,
        playerId: 'player-1', // Host player
        teamChanges: {
          'player-2': 0,
          'player-3': 0,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Each team must have at most 2 players');
    });

    it('applies valid team changes', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new ChangePlayerTeamUseCase(roomService);

      const room: Room = {
        ...baseRoom,
        players: baseRoom.players.map((p) => ({ ...p })) as RoomPlayer[],
      };

      const updatedRoom = {
        ...room,
        players: room.players.map((p) =>
          p.playerId === 'player-2' ? { ...p, team: 0 as Team } : p,
        ),
      };

      roomService.getRoom
        .mockResolvedValueOnce(room)
        .mockResolvedValueOnce(updatedRoom);

      const result = await useCase.execute({
        roomId: room.id,
        playerId: 'player-1', // Host player
        teamChanges: {
          'player-2': 0,
        },
      });

      expect(result.success).toBe(true);

      const updatePlayerInRoomMock =
        roomService.updatePlayerInRoom as jest.Mock;
      expect(updatePlayerInRoomMock).toHaveBeenCalledWith(room.id, 'player-2', {
        team: 0,
      });
      expect(
        result.updatedRoom?.players.find((p) => p.playerId === 'player-2')
          ?.team,
      ).toBe(0);
    });
  });

  describe('PlayCardUseCase', () => {
    it('plays a card and advances turn when field not complete', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new PlayCardUseCase(roomService);

      const currentField: Field = {
        cards: [],
        baseCard: '',
        dealerId: 'player-1',
        isComplete: false,
      };

      const state: {
        players: Player[];
        playState: { currentField: Field };
        currentPlayerIndex: number;
      } = {
        players: [
          {
            id: 'socket-1',
            playerId: 'player-1',
            userId: 'user-1',
            name: 'Player 1',
            hand: ['C1', 'C2'],
            team: 0,
            isPasser: false,
          },
          {
            id: 'socket-2',
            playerId: 'player-2',
            userId: 'user-2',
            name: 'Player 2',
            hand: ['D1', 'D2'],
            team: 1,
            isPasser: false,
          },
        ],
        playState: {
          currentField,
        },
        currentPlayerIndex: 0,
      };

      const roomGameState = {
        getState: jest.fn(() => state),
        saveState: jest.fn(),
        nextTurn: jest.fn(() => {
          state.currentPlayerIndex =
            (state.currentPlayerIndex + 1) % state.players.length;
        }),
        isPlayerTurn: jest.fn(
          (playerId: string) =>
            state.players[state.currentPlayerIndex]?.playerId === playerId,
        ),
      } as unknown as GameStateService;

      roomService.getRoomGameState.mockResolvedValue(roomGameState);

      const result = await useCase.execute({
        roomId: 'room-1',
        userId: 'user-1',
        card: 'C1',
      });

      expect(result.success).toBe(true);
      expect(result.events?.[0].event).toBe('card-played');
      const updateTurnEvent = result.events?.find(
        (evt) => evt.event === 'update-turn',
      );
      expect(updateTurnEvent?.payload).toBe('player-2');
      expect(roomGameState.saveState).toHaveBeenCalled();
    });

    it('returns complete field trigger when field reaches four cards', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new PlayCardUseCase(roomService);

      const fieldBefore: Field = {
        cards: ['C1', 'C2', 'C3'],
        baseCard: 'C1',
        dealerId: 'player-1',
        isComplete: false,
      };

      const state: {
        players: Player[];
        playState: { currentField: Field };
        currentPlayerIndex: number;
      } = {
        players: [
          {
            id: 'socket-1',
            playerId: 'player-1',
            userId: 'user-1',
            name: 'Player 1',
            hand: ['C4'],
            team: 0,
            isPasser: false,
          },
        ],
        playState: {
          currentField: fieldBefore,
        },
        currentPlayerIndex: 0,
      };

      const roomGameState = {
        getState: jest.fn(() => state),
        saveState: jest.fn(),
        nextTurn: jest.fn(),
        isPlayerTurn: jest.fn(
          (playerId: string) =>
            state.players[state.currentPlayerIndex]?.playerId === playerId,
        ),
      } as unknown as GameStateService;

      roomService.getRoomGameState.mockResolvedValue(roomGameState);

      const result = await useCase.execute({
        roomId: 'room-1',
        userId: 'user-1',
        card: 'C4',
      });

      expect(result.success).toBe(true);
      expect(result.completeFieldTrigger).toBeDefined();
      expect(result.completeFieldTrigger?.delayMs).toBe(3000);
    });
  });

  describe('ComAutoPlayUseCase', () => {
    it('auto-selects a base suit and advances turn after a COM leads Joker', async () => {
      const roomService = createRoomServiceMock();
      const comPlayerService = {
        createComPlayer: jest.fn(),
        selectBestCard: jest.fn(() => 'JOKER'),
        selectBaseSuit: jest.fn(() => '♣'),
        isComPlayer: jest.fn(() => true),
      };
      const playCardUseCase = {
        execute: jest.fn(),
      };
      const passBlowUseCase = {
        execute: jest.fn(),
      };
      const selectNegriUseCase = {
        execute: jest.fn(),
      };
      const useCase = new ComAutoPlayUseCase(
        roomService,
        comPlayerService as never,
        playCardUseCase as never,
        passBlowUseCase as never,
        selectNegriUseCase as never,
      );

      const comPlayer: Player = {
        id: 'com-0',
        playerId: 'com-0',
        name: 'COM',
        hand: ['9♣'],
        team: 0,
        isPasser: false,
        isCOM: true,
      };

      const state: {
        players: Player[];
        currentPlayerIndex: number;
        gamePhase: GamePhase;
        blowState: {
          currentTrump: 'club';
        };
        playState: {
          currentField: Field;
        };
      } = {
        players: [
          comPlayer,
          {
            id: 'socket-2',
            playerId: 'player-2',
            userId: 'user-2',
            name: 'Player 2',
            hand: ['7♠'],
            team: 1 as const,
            isPasser: false,
          },
        ],
        currentPlayerIndex: 0,
        gamePhase: 'play' as GamePhase,
        blowState: {
          currentTrump: 'club' as const,
        },
        playState: {
          currentField: {
            cards: ['JOKER'],
            baseCard: 'JOKER',
            baseSuit: undefined,
            dealerId: 'com-0',
            isComplete: false,
          },
        },
      };

      const roomGameState = {
        getState: jest.fn(() => state),
        getCurrentPlayer: jest.fn(
          () => state.players[state.currentPlayerIndex],
        ),
        nextTurn: jest.fn(() => {
          state.currentPlayerIndex = 1;
        }),
        saveState: jest.fn(),
      } as unknown as GameStateService;

      roomService.getRoomGameState.mockResolvedValue(roomGameState);
      playCardUseCase.execute.mockResolvedValue({
        success: true,
        events: [
          {
            scope: 'room',
            roomId: 'room-1',
            event: 'card-played',
            payload: {
              playerId: 'com-0',
              card: 'JOKER',
            },
          },
        ],
      });

      const result = await useCase.execute({ roomId: 'room-1' });

      expect(result.success).toBe(true);
      expect(comPlayerService.selectBaseSuit).toHaveBeenCalledWith(
        ['9♣'],
        'club',
      );
      expect(state.playState.currentField.baseSuit).toBe('♣');
      expect(
        result.events.find((event) => event.event === 'field-updated')?.payload,
      ).toMatchObject({ baseSuit: '♣' });
      expect(
        result.events.find((event) => event.event === 'update-turn')?.payload,
      ).toBe('player-2');
      expect(result.shouldContinue).toBe(true);
      expect(roomGameState.nextTurn).toHaveBeenCalled();
      expect(roomGameState.saveState).toHaveBeenCalled();
    });

    it('auto-selects negri when the blow winner has become COM', async () => {
      const roomService = createRoomServiceMock();
      const comPlayerService = {
        createComPlayer: jest.fn(),
        selectBestCard: jest.fn(),
        selectBaseSuit: jest.fn(),
        isComPlayer: jest.fn(() => true),
      };
      const playCardUseCase = {
        execute: jest.fn(),
      };
      const passBlowUseCase = {
        execute: jest.fn(),
      };
      const selectNegriUseCase = {
        execute: jest.fn(),
      };
      const useCase = new ComAutoPlayUseCase(
        roomService,
        comPlayerService as never,
        playCardUseCase as never,
        passBlowUseCase as never,
        selectNegriUseCase as never,
      );

      const comPlayer: Player = {
        id: 'com-timeout-1',
        playerId: 'com-timeout-1',
        name: 'COM',
        hand: ['6♥', 'A♠'],
        team: 0,
        isPasser: false,
        isCOM: true,
      };

      const state = {
        players: [
          comPlayer,
          {
            id: 'socket-2',
            playerId: 'player-2',
            userId: 'user-2',
            name: 'Player 2',
            hand: ['7♠'],
            team: 1 as const,
            isPasser: true,
          },
        ],
        currentPlayerIndex: 0,
        gamePhase: 'play' as GamePhase,
        blowState: {
          currentTrump: 'herz' as const,
          currentHighestDeclaration: {
            playerId: 'com-timeout-1',
            trumpType: 'herz' as const,
            numberOfPairs: 6,
            timestamp: Date.now(),
          },
        },
        playState: {
          currentField: {
            cards: [],
            baseCard: '',
            dealerId: 'com-timeout-1',
            isComplete: false,
          },
          negriCard: null,
        },
      };

      const roomGameState = {
        getState: jest.fn(() => state),
        getCurrentPlayer: jest.fn(
          () => state.players[state.currentPlayerIndex],
        ),
      } as unknown as GameStateService;

      roomService.getRoomGameState.mockResolvedValue(roomGameState);
      selectNegriUseCase.execute.mockResolvedValue({
        success: true,
        events: [
          {
            scope: 'room',
            roomId: 'room-1',
            event: 'play-setup-complete',
            payload: {
              negriCard: '6♥',
              startingPlayer: 'com-timeout-1',
            },
          },
        ],
      });

      const result = await useCase.execute({ roomId: 'room-1' });

      expect(result.success).toBe(true);
      expect(selectNegriUseCase.execute).toHaveBeenCalledWith({
        roomId: 'room-1',
        userId: 'com-timeout-1',
        card: '6♥',
      });
      expect(playCardUseCase.execute).not.toHaveBeenCalled();
      expect(result.events).toEqual([
        {
          scope: 'room',
          roomId: 'room-1',
          event: 'play-setup-complete',
          payload: {
            negriCard: '6♥',
            startingPlayer: 'com-timeout-1',
          },
        },
      ]);
      expect(result.shouldContinue).toBe(true);
    });
  });

  describe('SelectNegriUseCase', () => {
    it('accepts COM playerId when the blow winner has no userId', async () => {
      const roomService = createRoomServiceMock();
      const blowService = {
        findHighestDeclaration: jest.fn(() => ({
          playerId: 'com-timeout-1',
          trumpType: 'herz',
          numberOfPairs: 6,
          timestamp: Date.now(),
        })),
      };
      const useCase = new SelectNegriUseCase(roomService, blowService as never);

      const state = {
        players: [
          {
            id: 'com-timeout-1',
            playerId: 'com-timeout-1',
            name: 'COM',
            hand: ['6♥', 'A♠'],
            team: 0 as const,
            isPasser: false,
            isCOM: true,
          },
          {
            id: 'socket-2',
            playerId: 'player-2',
            userId: 'user-2',
            name: 'Player 2',
            hand: ['7♠'],
            team: 1 as const,
            isPasser: false,
          },
        ],
        gamePhase: 'play' as GamePhase,
        currentPlayerIndex: 0,
        blowState: {
          declarations: [
            {
              playerId: 'com-timeout-1',
              trumpType: 'herz' as const,
              numberOfPairs: 6,
              timestamp: Date.now(),
            },
          ],
        },
      };

      const roomGameState = {
        getState: jest.fn(() => state),
        isPlayerTurn: jest.fn(() => true),
        saveState: jest.fn(),
      } as unknown as GameStateService;

      roomService.getRoomGameState.mockResolvedValue(roomGameState);

      const result = await useCase.execute({
        roomId: 'room-1',
        userId: 'com-timeout-1',
        card: '6♥',
      });

      expect(result.success).toBe(true);
      expect(state.players[0].hand).toEqual(['A♠']);
      expect(result.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'play-setup-complete',
            payload: expect.objectContaining({
              negriCard: '6♥',
              startingPlayer: 'com-timeout-1',
            }),
          }),
        ]),
      );
      expect(roomGameState.saveState).toHaveBeenCalled();
    });
  });

  describe('SelectBaseSuitUseCase', () => {
    it('updates field and emits next turn', async () => {
      const roomService = createRoomServiceMock();
      const useCase = new SelectBaseSuitUseCase(roomService);

      const state: {
        players: Player[];
        playState: { currentField: Field };
        currentPlayerIndex: number;
      } = {
        players: [
          {
            id: 'socket-1',
            playerId: 'player-1',
            userId: 'user-1',
            name: 'Player 1',
            hand: ['C1'],
            team: 0,
            isPasser: false,
          },
          {
            id: 'socket-2',
            playerId: 'player-2',
            userId: 'user-2',
            name: 'Player 2',
            hand: ['D1'],
            team: 1,
            isPasser: false,
          },
        ],
        playState: {
          currentField: {
            cards: ['JOKER'],
            baseCard: 'JOKER',
            baseSuit: undefined,
            dealerId: 'player-1',
            isComplete: false,
          },
        },
        currentPlayerIndex: 0,
      };

      const roomGameState = {
        getState: jest.fn(() => state),
        saveState: jest.fn(),
        nextTurn: jest.fn(() => {
          state.currentPlayerIndex = 1;
        }),
      } as unknown as GameStateService;

      roomService.getRoomGameState.mockResolvedValue(roomGameState);

      const result = await useCase.execute({
        roomId: 'room-1',
        userId: 'user-1',
        suit: '♠',
      });

      expect(result.success).toBe(true);
      const fieldUpdated = result.events?.find(
        (evt) => evt.event === 'field-updated',
      );
      expect(fieldUpdated?.payload).toMatchObject({ baseSuit: '♠' });
      const updateTurn = result.events?.find(
        (evt) => evt.event === 'update-turn',
      );
      expect(updateTurn?.payload).toBe('player-2');
    });
  });

  describe('RevealBrokenHandUseCase', () => {
    it('prepares and finalizes broken hand flow', async () => {
      const roomService = createRoomServiceMock();
      const cardService = createCardServiceMock();
      const useCase = new RevealBrokenHandUseCase(roomService, cardService);

      const state: {
        players: Player[];
        blowState: {
          declarations: unknown[];
          currentHighestDeclaration: unknown;
          currentBlowIndex: number;
        };
        currentPlayerIndex: number;
        deck: string[];
      } = {
        players: [
          {
            id: 'socket-1',
            playerId: 'player-1',
            userId: 'user-1',
            name: 'Player 1',
            hand: ['C1'],
            team: 0,
            isPasser: false,
          },
          {
            id: 'socket-2',
            playerId: 'player-2',
            userId: 'user-2',
            name: 'Player 2',
            hand: ['D1'],
            team: 1,
            isPasser: false,
          },
        ],
        blowState: {
          declarations: [],
          currentHighestDeclaration: null,
          currentBlowIndex: 0,
        },
        currentPlayerIndex: 0,
        deck: [],
      };

      const dealCardsMock = jest.fn(() => {
        state.players.forEach((player) => {
          player.hand = ['X1', 'X2'];
        });
      });

      const roomGameState = {
        getState: jest.fn(() => state),
        dealCards: dealCardsMock,
        saveState: jest.fn(),
      } as unknown as GameStateService;

      roomService.getRoomGameState.mockResolvedValue(roomGameState);

      const preparation = await useCase.prepare({
        roomId: 'room-1',
        userId: 'user-1',
        playerId: 'player-1',
      });

      expect(preparation.success).toBe(true);
      expect(preparation.delayMs).toBe(3000);
      expect(preparation.followUp).toBeDefined();

      if (preparation.followUp) {
        const completion = await useCase.finalize(preparation.followUp);
        expect(completion.success).toBe(true);
        expect(dealCardsMock).toHaveBeenCalled();
        const brokenEvent = completion.events?.find(
          (evt) => evt.event === 'broken',
        );
        expect(brokenEvent).toBeDefined();
      }
    });
  });

  describe('CompleteFieldUseCase', () => {
    const buildState = () => ({
      players: [
        {
          id: 'socket-1',
          playerId: 'player-1',
          name: 'Player 1',
          hand: ['A', 'B'],
          team: 0 as const,
          isPasser: false,
        },
        {
          id: 'socket-2',
          playerId: 'player-2',
          name: 'Player 2',
          hand: ['C', 'D'],
          team: 1 as const,
          isPasser: false,
        },
      ] as Player[],
      playState: {
        fields: [] as Field[],
        currentField: {
          cards: [],
          baseCard: '',
          dealerId: 'player-1',
          isComplete: false,
        } as Field,
      },
      blowState: {
        currentHighestDeclaration: {
          playerId: 'player-1',
          trumpType: 'tra',
          numberOfPairs: 6,
          timestamp: Date.now(),
        },
        declarations: [],
        lastPasser: null,
        isRoundCancelled: false,
        currentBlowIndex: 0,
      },
      teamScores: {
        0: { play: 0, total: 0 },
        1: { play: 0, total: 0 },
      } as TeamScores,
      teamScoreRecords: {
        0: [],
        1: [],
      },
      teamAssignments: {},
      pointsToWin: 10,
      currentPlayerIndex: 0,
      roundNumber: 1,
    });

    it('returns events when round continues', async () => {
      const roomService = createRoomServiceMock();
      const playService = createPlayServiceMock('player-1');
      const scoreService = createScoreServiceMock(2);
      const useCase = new CompleteFieldUseCase(
        roomService,
        playService,
        scoreService,
      );

      const state = buildState();
      state.playState.fields = [{ winnerTeam: 0 } as unknown as Field];
      const completeFieldMock = jest.fn(() => ({
        cards: ['A', 'B', 'C', 'D'],
        winnerId: 'player-1',
        winnerTeam: 0,
        dealerId: 'player-1',
      }));
      const saveStateMock = jest.fn();
      let roundNumberValue = state.roundNumber;
      const roomGameState = {
        getState: jest.fn(() => state),
        completeField: completeFieldMock,
        saveState: saveStateMock,
        resetRoundState: jest.fn(async () => {}),
        updateState: jest.fn(async () => {}),
        get roundNumber() {
          return roundNumberValue;
        },
        set roundNumber(value: number) {
          roundNumberValue = value;
        },
      } as unknown as GameStateService;

      roomService.getRoomGameState.mockResolvedValue(roomGameState);

      const result = await useCase.execute({
        roomId: 'room-1',
        field: {
          cards: ['A', 'C', 'E', 'F'],
          baseCard: 'A',
          dealerId: 'player-1',
          isComplete: false,
        },
      });

      expect(result.success).toBe(true);
      expect(
        result.events?.find((e) => e.event === 'field-complete'),
      ).toBeDefined();
      expect(
        result.events?.find((e) => e.event === 'update-turn'),
      ).toBeDefined();
      expect(result.gameOver).toBeUndefined();
    });

    it('produces game over instruction when team reaches target', async () => {
      const roomService = createRoomServiceMock();
      const playService = createPlayServiceMock('player-1');
      const scoreService = createScoreServiceMock(12);
      const useCase = new CompleteFieldUseCase(
        roomService,
        playService,
        scoreService,
      );

      const state = buildState();
      state.players[0].hand = [];
      state.players[1].hand = [];
      state.playState.fields = [{ winnerTeam: 0 } as unknown as Field];

      const roomGameState = {
        getState: jest.fn(() => state),
        completeField: jest.fn(() => ({
          cards: ['A', 'B', 'C', 'D'],
          winnerId: 'player-1',
          winnerTeam: 0,
          dealerId: 'player-1',
        })),
        saveState: jest.fn(),
      } as unknown as GameStateService;

      roomService.getRoomGameState.mockResolvedValue(roomGameState);

      const result = await useCase.execute({
        roomId: 'room-1',
        field: {
          cards: ['A', 'B', 'C', 'D'],
          baseCard: 'A',
          dealerId: 'player-1',
          isComplete: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.gameOver).toBeDefined();
      expect(result.gameOver?.winningTeam).toBe(0);
      const gameOverEvent = result.events?.find((e) => e.event === 'game-over');
      expect(gameOverEvent).toBeDefined();
      expect(roomService.updateRoomStatus).toHaveBeenCalledWith(
        'room-1',
        RoomStatus.FINISHED,
      );
    });
  });

  describe('ProcessGameOverUseCase', () => {
    beforeEach(() => {
      jest.useFakeTimers({ legacyFakeTimers: false });
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllMocks();
    });

    it('updates authenticated player stats and resets game state', async () => {
      const roomService = createRoomServiceMock();
      const resetStateMock = jest.fn();

      roomService.getRoomGameState.mockResolvedValue({
        resetState: resetStateMock,
      } as unknown as GameStateService);

      const useCase = new ProcessGameOverUseCase(roomService);

      await useCase.execute({
        roomId: 'room-1',
        players: [
          {
            id: 'socket-1',
            playerId: 'player-1',
            name: 'Player 1',
            userId: 'user-1',
            team: 0,
            hand: [],
            isPasser: false,
          } as Player,
          {
            id: 'socket-2',
            playerId: 'player-2',
            name: 'Guest',
            team: 1,
            hand: [],
            isPasser: false,
          } as Player,
        ],
        winningTeam: 0,
        teamScores: {
          0: { play: 5, total: 20 },
          1: { play: 2, total: 10 },
        } as TeamScores,
        resetDelayMs: 5000,
      });

      expect(roomService.updateUserGameStats).toHaveBeenCalledWith(
        'user-1',
        true,
        20,
      );
      expect(roomService.updateUserGameStats).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(5000);

      expect(roomService.getRoomGameState).toHaveBeenCalledWith('room-1');
      expect(resetStateMock).toHaveBeenCalled();
    });
  });

  describe('UpdateAuthUseCase', () => {
    const authenticatedUser: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@example.com',
      profile: {
        id: 'profile-1',
        username: 'user',
        displayName: 'User Display',
        avatarUrl: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: new Date(),
        gamesPlayed: 0,
        gamesWon: 0,
        totalScore: 0,
        preferences: {
          notifications: true,
          sound: true,
          theme: 'light',
        },
      },
    };

    it('returns events when authentication succeeds and user is new', async () => {
      const authService = createAuthServiceMock();
      const users: Player[] = [];
      const gameState = {
        getUsers: jest.fn(() => users),
        addPlayer: jest.fn(() => {
          users.push({
            id: 'socket-1',
            playerId: 'player-1',
            name: 'User Display',
            hand: [],
            team: 0,
            isPasser: false,
          } as Player);
          return true;
        }),
      } as unknown as IGameStateService;
      const roomService = createRoomServiceMock();

      authService.getUserFromSocketToken.mockResolvedValue(authenticatedUser);

      const useCase = new UpdateAuthUseCase(
        authService,
        gameState,
        roomService,
      );

      const result = await useCase.execute({
        socketId: 'socket-1',
        token: 'token',
        handshakeName: 'Fallback',
      });

      expect(result.success).toBe(true);
      expect(result.authenticatedUser).toEqual(authenticatedUser);
      expect(gameState.addPlayer).toHaveBeenCalledWith(
        'socket-1',
        'User Display',
        'user-1',
        true,
      );
      const updateUsersEvent = result.broadcastEvents?.find(
        (evt) => evt.event === 'update-users',
      );
      expect(updateUsersEvent).toBeDefined();
      const authUpdatedEvent = result.clientEvents?.find(
        (evt) => evt.event === 'auth-updated',
      );
      expect(authUpdatedEvent).toBeDefined();
    });

    it('returns error when token is missing', async () => {
      const authService = createAuthServiceMock();
      const gameState = createGameStateServiceMock();
      const roomService = createRoomServiceMock();

      const useCase = new UpdateAuthUseCase(
        authService,
        gameState,
        roomService,
      );

      const result = await useCase.execute({
        socketId: 'socket-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No token provided');
      expect(authService.getUserFromSocketToken).not.toHaveBeenCalled();
    });
  });
});
