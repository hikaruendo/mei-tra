import { GameStateService } from '../game-state.service';
import { RoomService } from '../room.service';
import { IGameStateRepository } from '../../repositories/interfaces/game-state.repository.interface';
import { IRoomRepository } from '../../repositories/interfaces/room.repository.interface';
import { IUserProfileRepository } from '../../repositories/interfaces/user-profile.repository.interface';
import { GameStateFactory } from '../game-state.factory';
import { DomainPlayer, GameState } from '../../types/game.types';
import { Room, RoomStatus, RoomPlayer } from '../../types/room.types';
import { CardService } from '../card.service';
import { ChomboService } from '../chombo.service';
import { PlayService } from '../play.service';
import { IComPlayerService } from '../interfaces/com-player-service.interface';
import { RoomMembershipService } from '../room-membership.service';
import { asSeatId } from '../../types/identity.types';

const makeGamePlayer = (
  seatId: string,
  name: string,
  team: 0 | 1,
  overrides: Partial<DomainPlayer> = {},
): DomainPlayer => ({
  seatId: asSeatId(seatId),
  name,
  team,
  hand: [],
  isPasser: false,
  hasBroken: false,
  hasRequiredBroken: false,
  ...overrides,
});

const makeRoomPlayer = (
  seatId: string,
  name: string,
  team: 0 | 1,
  overrides: Partial<RoomPlayer> = {},
): RoomPlayer => ({
  socketId: '',
  seatId: asSeatId(seatId),
  name,
  team,
  hand: [],
  isPasser: false,
  hasBroken: false,
  hasRequiredBroken: false,
  isReady: true,
  isHost: false,
  joinedAt: new Date(),
  ...overrides,
});

describe('Reconnection Token Management', () => {
  describe('GameStateService', () => {
    let gameStateService: GameStateService;
    let gameStateRepository: jest.Mocked<IGameStateRepository>;
    let cardService: CardService;
    let playService: PlayService;
    let chomboService: ChomboService;

    beforeEach(() => {
      gameStateRepository = {
        findByRoomId: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockImplementation(
          async (_roomId: string, state: Partial<GameState>) =>
            ({
              ...state,
              version: ((state as GameState).version ?? 0) + 1,
            }) as GameState,
        ),
        persistRoomRoster: jest
          .fn()
          .mockImplementation(
            async (
              _roomId: string,
              _roomPlayers: RoomPlayer[],
              state: GameState,
            ) => ({
              ...state,
              version: (state.version ?? 0) + 1,
            }),
          ),
        delete: jest.fn(),
        updatePlayers: jest.fn(),
        updatePlayerConnection: jest.fn(),
        updateGamePhase: jest.fn(),
        bulkUpdate: jest.fn(),
        deleteExpiredGameStates: jest.fn(),
      } as jest.Mocked<IGameStateRepository>;

      cardService = new CardService();
      playService = new PlayService(cardService);
      chomboService = new ChomboService(playService);
      gameStateService = new GameStateService(
        cardService,
        chomboService,
        gameStateRepository,
      );
    });

    describe('registerSeatToken', () => {
      it('should register a seat token in the token map', () => {
        const token = 'test-token-123';
        const seatId = asSeatId('player-1');

        gameStateService.registerSeatToken(token, seatId);

        // Verify by trying to find player by token
        const player = makeGamePlayer('player-1', 'Test Player', 0);

        // Add player to state first
        gameStateService.getState().players.push(player);

        const foundPlayer = gameStateService.findPlayerByReconnectToken(token);
        expect(foundPlayer).toBeTruthy();
        expect(foundPlayer?.seatId).toBe(seatId);
      });

      it('should overwrite existing token', () => {
        const token = 'test-token';
        const seatId1 = asSeatId('player-1');
        const seatId2 = asSeatId('player-2');

        gameStateService.registerSeatToken(token, seatId1);
        gameStateService.registerSeatToken(token, seatId2);

        const player1 = makeGamePlayer('player-1', 'Player 1', 0);

        const player2 = makeGamePlayer('player-2', 'Player 2', 1);

        gameStateService.getState().players.push(player1, player2);

        const foundPlayer = gameStateService.findPlayerByReconnectToken(token);
        expect(foundPlayer?.seatId).toBe(seatId2);
      });
    });

    describe('removeSeatToken', () => {
      it('should remove a seat token from the token map', () => {
        const token = 'test-token';
        const seatId = asSeatId('player-1');

        const player = makeGamePlayer('player-1', 'Test Player', 0);
        gameStateService.getState().players.push(player);

        gameStateService.registerSeatToken(token, seatId);

        // Token should find player
        expect(gameStateService.findPlayerByReconnectToken(token)?.seatId).toBe(
          seatId,
        );

        // Remove token
        gameStateService.removeSeatToken(seatId);

        // Should still find by fallback (seatId directly in players array)
        const foundPlayer = gameStateService.findPlayerByReconnectToken(seatId);
        expect(foundPlayer?.seatId).toBe(seatId);
      });

      it('should only remove token for specified player', () => {
        const token1 = 'token-1';
        const token2 = 'token-2';
        const seatId1 = asSeatId('player-1');
        const seatId2 = asSeatId('player-2');

        const player1 = makeGamePlayer('player-1', 'Player 1', 0);

        const player2 = makeGamePlayer('player-2', 'Player 2', 1);

        gameStateService.getState().players.push(player1, player2);

        gameStateService.registerSeatToken(token1, seatId1);
        gameStateService.registerSeatToken(token2, seatId2);

        // Remove token1
        gameStateService.removeSeatToken(seatId1);

        // Token1 should be removed, but can still find by seatId fallback
        expect(
          gameStateService.findPlayerByReconnectToken(seatId1)?.seatId,
        ).toBe(seatId1); // Fallback works

        // Token2 should still exist
        expect(
          gameStateService.findPlayerByReconnectToken(token2)?.seatId,
        ).toBe(seatId2);
      });
    });

    describe('loadState', () => {
      it('should rebuild seatIds map from persisted players', async () => {
        const roomId = 'room-123';
        const persistedState: GameState = {
          players: [
            {
              seatId: asSeatId('player-1'),
              name: 'Player 1',
              team: 0,
              hand: ['H2', 'D3'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
            {
              seatId: asSeatId('player-2'),
              name: 'Player 2',
              team: 1,
              hand: ['C4', 'S5'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
          ],
          currentSeatId: asSeatId('player-1'),
          gamePhase: 'play',
          deck: [],
          blowState: {
            currentTrump: null,
            currentHighestDeclaration: null,
            declarations: [],
            actionHistory: [],
            lastPasserSeatId: null,
            isRoundCancelled: false,
            currentBlowIndex: 0,
          },
          roundNumber: 1,
          pointsToWin: 10,
          teamScores: {
            0: { play: 0, total: 0 },
            1: { play: 0, total: 0 },
          },
          teamScoreRecords: {
            0: [],
            1: [],
          },
          teamAssignments: {},
        };

        gameStateRepository.findByRoomId.mockResolvedValue(persistedState);

        await gameStateService.loadState(roomId);

        // Verify seatIds map was rebuilt
        const foundPlayer1 =
          gameStateService.findPlayerByReconnectToken('player-1');
        const foundPlayer2 =
          gameStateService.findPlayerByReconnectToken('player-2');

        expect(foundPlayer1?.seatId).toBe('player-1');
        expect(foundPlayer2?.seatId).toBe('player-2');
        expect(gameStateService.getState().currentSeatId).toBe('player-1');
        expect(gameStateRepository.update).not.toHaveBeenCalled();
      });

      it('should handle empty players array', async () => {
        const roomId = 'room-empty';
        const persistedState: GameState = {
          players: [],
          currentSeatId: null,
          gamePhase: null,
          deck: [],
          blowState: {
            currentTrump: null,
            currentHighestDeclaration: null,
            declarations: [],
            actionHistory: [],
            lastPasserSeatId: null,
            isRoundCancelled: false,
            currentBlowIndex: 0,
          },
          roundNumber: 1,
          pointsToWin: 10,
          teamScores: {
            0: { play: 0, total: 0 },
            1: { play: 0, total: 0 },
          },
          teamScoreRecords: {
            0: [],
            1: [],
          },
          teamAssignments: {},
        };

        gameStateRepository.findByRoomId.mockResolvedValue(persistedState);

        await expect(gameStateService.loadState(roomId)).resolves.not.toThrow();
      });

      it('should surface persistence failures instead of caching empty state', async () => {
        const roomId = 'room-load-failure';
        gameStateRepository.findByRoomId.mockRejectedValue(
          new Error('database unavailable'),
        );

        await expect(gameStateService.loadState(roomId)).rejects.toThrow(
          'database unavailable',
        );
        expect(gameStateRepository.create).not.toHaveBeenCalled();
      });
    });

    describe('reconcileWaitingRoomPlayers', () => {
      it('repairs and persists a stale waiting-room roster', async () => {
        const roomId = 'room-cold-start';
        const roomPlayers: RoomPlayer[] = [
          {
            socketId: 'stale-socket',
            seatId: asSeatId('seat-1'),
            userId: 'user-1',
            isAuthenticated: true,
            name: 'User 1',
            hand: [],
            team: 1,
            isPasser: false,
            isCOM: false,
            hasBroken: false,
            hasRequiredBroken: false,
            isReady: true,
            isHost: true,
            joinedAt: new Date('2026-07-19T00:00:00.000Z'),
          },
        ];

        gameStateService.setRoomId(roomId);
        gameStateService.getState().players = [];

        await gameStateService.reconcileWaitingRoomPlayers(roomPlayers);

        expect(gameStateService.getState().players).toEqual([
          expect.objectContaining({
            seatId: asSeatId('seat-1'),
            name: 'User 1',
            team: 1,
          }),
        ]);
        expect(gameStateService.getState().teamAssignments).toEqual({
          'seat-1': 1,
        });
        expect(gameStateService.findPlayerByReconnectToken('user-1')).toEqual(
          expect.objectContaining({ seatId: asSeatId('seat-1') }),
        );
        expect(gameStateRepository.persistRoomRoster).toHaveBeenCalledWith(
          roomId,
          roomPlayers,
          expect.objectContaining({
            players: gameStateService.getState().players,
            teamAssignments: { 'seat-1': 1 },
          }),
          'seat-1',
          undefined,
        );
      });
    });
  });

  describe('RoomService - Reconnection Features', () => {
    let roomService: RoomService;
    let roomRepository: jest.Mocked<IRoomRepository>;
    let userProfileRepository: jest.Mocked<IUserProfileRepository>;
    let gameStateFactory: GameStateFactory;
    let gameStateRepository: jest.Mocked<IGameStateRepository>;

    const baseRoom: Room = {
      id: 'room-123',
      name: 'Test Room',
      hostSeatId: asSeatId('player-1'),
      status: RoomStatus.PLAYING,
      settings: {
        maxPlayers: 4,
        isPrivate: false,
        password: null,
        teamAssignmentMethod: 'random',
        pointsToWin: 10,
        allowSpectators: true,
      },
      players: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    };

    beforeEach(() => {
      roomRepository = {
        findAll: jest.fn(),
        findById: jest.fn(),
        createWithHostSeat: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findRoomsOlderThan: jest.fn(),
        findByStatus: jest.fn(),
        findByHostId: jest.fn(),
        findRecentFinishedByUserId: jest.fn(),
        updateStatus: jest.fn(),
        updateLastActivity: jest.fn(),
        deleteExpiredRooms: jest.fn(),
      } as jest.Mocked<IRoomRepository>;

      userProfileRepository = {
        findById: jest.fn(),
        findByUsername: jest.fn(),
        findByUserIds: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        updateLastSeen: jest.fn(),
        updateGameStats: jest.fn(),
        searchByUsername: jest.fn(),
      } as jest.Mocked<IUserProfileRepository>;

      gameStateRepository = {
        findByRoomId: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockImplementation(
          async (_roomId: string, state: Partial<GameState>) =>
            ({
              ...state,
              version: ((state as GameState).version ?? 0) + 1,
            }) as GameState,
        ),
        persistRoomRoster: jest
          .fn()
          .mockImplementation(
            async (
              _roomId: string,
              _roomPlayers: RoomPlayer[],
              state: GameState,
            ) => ({
              ...state,
              version: (state.version ?? 0) + 1,
            }),
          ),
        delete: jest.fn(),
        updatePlayers: jest.fn(),
        updatePlayerConnection: jest.fn(),
        updateGamePhase: jest.fn(),
        bulkUpdate: jest.fn(),
        deleteExpiredGameStates: jest.fn(),
      } as jest.Mocked<IGameStateRepository>;

      const cardService = new CardService();
      const playService = new PlayService(cardService);
      const chomboService = new ChomboService(playService);
      const comPlayerService: jest.Mocked<IComPlayerService> = {
        createComPlayer: jest.fn(),
        isComPlayer: jest.fn(),
      };
      gameStateFactory = new GameStateFactory(
        cardService,
        chomboService,
        gameStateRepository,
      );

      const roomMembershipService = {
        get: jest.fn().mockResolvedValue(null),
        reserve: jest.fn(),
        claim: jest
          .fn()
          .mockImplementation(
            (userId: string, roomId: string, seatId: string) =>
              Promise.resolve({
                result: 'reconnected',
                membership: {
                  userId,
                  roomId,
                  seatId: asSeatId(seatId),
                  status: 'active',
                  membershipVersion: 1,
                  transitionId: 'transition-1',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  lastSeenAt: new Date(),
                },
              }),
          ),
        cancelReservation: jest.fn().mockResolvedValue(false),
        release: jest.fn().mockResolvedValue('released'),
        releaseBySeat: jest.fn().mockResolvedValue(true),
        releaseRoom: jest.fn().mockResolvedValue(0),
      } as unknown as RoomMembershipService;

      roomService = new RoomService(
        roomRepository,
        userProfileRepository,
        gameStateFactory,
        comPlayerService,
        roomMembershipService,
      );
    });

    afterEach(() => {
      roomService.onModuleDestroy();
    });

    const cloneRoomPlayer = (player: RoomPlayer): RoomPlayer => ({
      ...player,
      hand: [...player.hand],
      joinedAt: new Date(player.joinedAt),
    });

    const cloneRoom = (room: Room): Room => ({
      ...room,
      players: room.players.map(cloneRoomPlayer),
      createdAt: new Date(room.createdAt),
      updatedAt: new Date(room.updatedAt),
      lastActivityAt: new Date(room.lastActivityAt),
    });

    const bindRoomRepositoryToState = (initialRoom: Room) => {
      let persistedRoom: Room | null = cloneRoom(initialRoom);

      roomRepository.findById.mockImplementation(async (roomId) => {
        if (!persistedRoom || persistedRoom.id !== roomId) {
          return null;
        }

        return cloneRoom(persistedRoom);
      });

      roomRepository.update.mockImplementation(async (roomId, updates) => {
        if (!persistedRoom || persistedRoom.id !== roomId) {
          return null;
        }

        persistedRoom = cloneRoom({
          ...persistedRoom,
          ...updates,
          players:
            updates.players?.map(cloneRoomPlayer) ?? persistedRoom.players,
        });
        return cloneRoom(persistedRoom);
      });

      roomRepository.updateLastActivity.mockImplementation(async (roomId) => {
        if (persistedRoom && persistedRoom.id === roomId) {
          persistedRoom.lastActivityAt = new Date();
        }
      });

      roomRepository.delete.mockImplementation(async (roomId) => {
        if (persistedRoom?.id === roomId) {
          persistedRoom = null;
        }
      });

      gameStateRepository.persistRoomRoster.mockImplementation(
        async (roomId, roomPlayers, state, hostId) => {
          if (persistedRoom?.id === roomId) {
            persistedRoom = cloneRoom({
              ...persistedRoom,
              hostSeatId: asSeatId(hostId ?? persistedRoom.hostSeatId),
              players: roomPlayers.map((player) => ({
                ...player,
                socketId: '',
              })),
            });
          }
          return {
            ...state,
            version: (state.version ?? 0) + 1,
          };
        },
      );

      return {
        getPersistedRoom: () =>
          persistedRoom ? cloneRoom(persistedRoom) : null,
      };
    };

    it('does not create game state for a deleted room', async () => {
      roomRepository.findById.mockResolvedValue(null);

      await expect(
        roomService.getRoomGameState('deleted-room'),
      ).rejects.toThrow('Room not found: deleted-room');
      expect(gameStateRepository.findByRoomId).not.toHaveBeenCalled();
      expect(gameStateRepository.create).not.toHaveBeenCalled();
    });

    it('does not overwrite current gameplay when updating roster metadata', async () => {
      const player = makeGamePlayer('player-1', 'Player 1', 0, {
        hand: ['stale-card'],
      });
      bindRoomRepositoryToState({
        ...baseRoom,
        players: [
          {
            ...player,
            socketId: 'socket-1',
            isReady: true,
            isHost: true,
            joinedAt: new Date(),
          },
        ],
      });
      const gameState = await roomService.getRoomGameState(baseRoom.id);
      gameState.getState().players = [
        {
          ...player,
          hand: ['current-card'],
        },
      ];

      await roomService.updatePlayerInRoom(baseRoom.id, player.seatId, {
        team: 1,
      });

      expect(gameState.getState().players[0]).toEqual(
        expect.objectContaining({
          team: 1,
          hand: ['current-card'],
        }),
      );
    });

    describe('convertPlayerToCOM', () => {
      it('does not convert a player who reconnected before timeout handling', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');
        const player: RoomPlayer = {
          socketId: 'socket-new',
          seatId: asSeatId(seatId),
          name: 'Test Player',
          team: 0,
          hand: ['H2'],
          isPasser: false,
          hasBroken: false,
          isReady: true,
          isHost: true,
          joinedAt: new Date(),
        };
        const room: Room = { ...baseRoom, players: [player] };
        roomRepository.findById.mockResolvedValue(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          makeGamePlayer(seatId, player.name, player.team, {
            hand: [...player.hand],
          }),
        ];
        await gameState.applyPlayerConnectionState(seatId, {
          socketId: 'socket-new',
        });

        const result = await roomService.convertPlayerToCOM(roomId, seatId, {
          requireDisconnected: true,
        });

        expect(result).toBe(false);
        expect(room.players[0]).toEqual(player);
        expect(gameStateRepository.persistRoomRoster).not.toHaveBeenCalled();
      });

      it('should convert player to com and save to vacantSeats', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');

        const player: RoomPlayer = {
          socketId: 'socket-1',
          seatId: asSeatId('player-1'),
          name: 'Test Player',
          team: 0,
          hand: ['H2', 'D3', 'C4'],
          isPasser: false,
          hasBroken: false,
          isReady: true,
          isHost: true,
          joinedAt: new Date(),
        };

        const room: Room = {
          ...baseRoom,
          players: [player],
        };

        roomRepository.findById.mockResolvedValue(room);

        const result = await roomService.convertPlayerToCOM(roomId, seatId);

        expect(result).toBe(true);

        const persistedRoster =
          gameStateRepository.persistRoomRoster.mock.calls[0][1];
        expect(persistedRoster[0].seatId).toBe(seatId);
        expect(persistedRoster[0].isCOM).toBe(true);
        expect(persistedRoster[0].name).toBe('COM');
      });

      it('should keep reconnectToken when converting to com', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');

        const player: RoomPlayer = {
          socketId: 'socket-1',
          seatId: asSeatId('player-1'),
          name: 'Test Player',
          team: 0,
          hand: ['H2', 'D3'],
          isPasser: false,
          hasBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date(),
        };

        const room: Room = {
          ...baseRoom,
          players: [player],
        };

        roomRepository.findById.mockResolvedValue(room);

        // Register token first
        const gameState = await roomService.getRoomGameState(roomId);
        gameState.registerSeatToken(seatId, seatId);

        await roomService.convertPlayerToCOM(roomId, seatId);

        expect(gameState.findPlayerByReconnectToken(seatId)?.seatId).toBe(
          seatId,
        );
      });

      it('should keep current play references on the stable seat', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');

        const player: RoomPlayer = {
          socketId: 'socket-1',
          seatId: asSeatId(seatId),
          name: 'Test Player',
          team: 0,
          hand: ['JOKER', '9♣'],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date(),
        };

        const room: Room = {
          ...baseRoom,
          players: [player],
        };

        roomRepository.findById.mockResolvedValue(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            seatId: asSeatId(seatId),
            name: player.name,
            team: player.team,
            hand: [...player.hand],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
        ];
        gameState.getState().playState = {
          currentField: {
            cards: ['JOKER'],
            playedBy: [seatId],
            baseCard: 'JOKER',
            dealerSeatId: asSeatId(seatId),
            isComplete: false,
          },
          negriCard: null,
          neguri: { [seatId]: '9♣' },
          fields: [
            {
              cards: ['7♣', '8♣', '9♣', '10♣'],
              winnerSeatId: asSeatId(seatId),
              winnerTeam: 0,
              dealerSeatId: asSeatId(seatId),
            },
          ],
          lastWinnerSeatId: asSeatId(seatId),
          openDeclared: false,
          openDeclarerSeatId: asSeatId(seatId),
        };
        gameState.getState().pendingBrokenHandReveal = {
          seatId: asSeatId(seatId),
          handSnapshot: ['JOKER', '9♣'],
          startedAt: 100,
        };
        gameState.getState().teamAssignments[seatId] = 0;

        const result = await roomService.convertPlayerToCOM(roomId, seatId);

        expect(result).toBe(true);
        const comSeatId = gameState.getState().players[0].seatId;
        expect(comSeatId).toBe(seatId);
        expect(gameState.getState().playState?.currentField?.dealerSeatId).toBe(
          comSeatId,
        );
        expect(gameState.getState().playState?.currentField?.playedBy).toEqual([
          comSeatId,
        ]);
        expect(gameState.getState().playState?.fields[0]?.winnerSeatId).toBe(
          comSeatId,
        );
        expect(gameState.getState().playState?.fields[0]?.dealerSeatId).toBe(
          comSeatId,
        );
        expect(gameState.getState().playState?.lastWinnerSeatId).toBe(
          comSeatId,
        );
        expect(gameState.getState().playState?.openDeclarerSeatId).toBe(
          comSeatId,
        );
        expect(gameState.getState().pendingBrokenHandReveal?.seatId).toBe(
          comSeatId,
        );
        expect(gameState.getState().playState?.neguri[comSeatId]).toBe('9♣');
        expect(gameState.getState().teamAssignments[comSeatId]).toBe(0);
      });

      it('should keep current blow references on the stable seat', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');

        const player: RoomPlayer = {
          socketId: 'socket-1',
          seatId: asSeatId(seatId),
          name: 'Test Player',
          team: 0,
          hand: ['JOKER', '9♣'],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date(),
        };

        const room: Room = {
          ...baseRoom,
          players: [player],
        };

        roomRepository.findById.mockResolvedValue(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            seatId: asSeatId(seatId),
            name: player.name,
            team: player.team,
            hand: [...player.hand],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
        ];
        gameState.getState().blowState = {
          currentTrump: null,
          currentHighestDeclaration: {
            seatId: asSeatId(seatId),
            trumpType: 'tra',
            numberOfPairs: 6,
            timestamp: 1,
          },
          declarations: [
            {
              seatId: asSeatId(seatId),
              trumpType: 'tra',
              numberOfPairs: 6,
              timestamp: 1,
            },
          ],
          actionHistory: [
            {
              type: 'declare',
              seatId: asSeatId(seatId),
              trumpType: 'tra',
              numberOfPairs: 6,
              timestamp: 1,
            },
            {
              type: 'pass',
              seatId: asSeatId(seatId),
              timestamp: 2,
            },
          ],
          lastPasserSeatId: asSeatId(seatId),
          isRoundCancelled: false,
          currentBlowIndex: 0,
        };

        const result = await roomService.convertPlayerToCOM(roomId, seatId);

        expect(result).toBe(true);
        const comSeatId = gameState.getState().players[0].seatId;
        expect(comSeatId).toBe(seatId);
        expect(
          gameState.getState().blowState.currentHighestDeclaration?.seatId,
        ).toBe(comSeatId);
        expect(gameState.getState().blowState.declarations[0]?.seatId).toBe(
          comSeatId,
        );
        expect(
          gameState
            .getState()
            .blowState.actionHistory.map((action) => action.seatId),
        ).toEqual([comSeatId, comSeatId]);
        expect(gameState.getState().blowState.lastPasserSeatId).toBe(comSeatId);
      });

      it('should generate a unique COM id when another COM already has the same seat index id', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');
        const existingComId = 'com-timeout-1-old';

        const existingCom: RoomPlayer = {
          socketId: existingComId,
          seatId: asSeatId(existingComId),
          name: 'COM',
          team: 1,
          hand: ['7♣'],
          isCOM: true,
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date(),
        };

        const player: RoomPlayer = {
          socketId: 'socket-1',
          seatId: asSeatId(seatId),
          name: 'Test Player',
          team: 0,
          hand: ['JOKER', '9♣'],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date(),
        };

        const room: Room = {
          ...baseRoom,
          players: [existingCom, player],
        };

        const roomState = bindRoomRepositoryToState(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            seatId: asSeatId(existingCom.seatId),
            name: existingCom.name,
            team: existingCom.team,
            hand: [...existingCom.hand],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
            isCOM: true,
          },
          {
            seatId: asSeatId(seatId),
            name: player.name,
            team: player.team,
            hand: [...player.hand],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
        ];

        const result = await roomService.convertPlayerToCOM(roomId, seatId);

        expect(result).toBe(true);
        const convertedSeatId =
          roomState.getPersistedRoom()?.players[1]?.seatId ?? '';
        expect(convertedSeatId).toBe(seatId);
        expect(convertedSeatId).not.toBe(existingCom.seatId);
        expect(
          new Set(
            roomState
              .getPersistedRoom()
              ?.players.map((player) => player.seatId) ?? [],
          ).size,
        ).toBe(roomState.getPersistedRoom()?.players.length);
      });

      it('should return false if room not found', async () => {
        roomRepository.findById.mockResolvedValue(null);

        const result = await roomService.convertPlayerToCOM(
          'missing-room',
          asSeatId('player-1'),
        );

        expect(result).toBe(false);
      });

      it('should return false if player not found in room', async () => {
        const room: Room = {
          ...baseRoom,
          players: [],
        };

        roomRepository.findById.mockResolvedValue(room);

        const result = await roomService.convertPlayerToCOM(
          'room-123',
          asSeatId('missing-player'),
        );

        expect(result).toBe(false);
      });
    });

    describe('joinRoom with seatId matching', () => {
      it('replaces a waiting COM with an authenticated newcomer as a human', async () => {
        const roomId = 'room-newcomer';
        const host = {
          socketId: 'socket-host',
          seatId: asSeatId('seat-host'),
          userId: 'user-host',
          isAuthenticated: true,
          name: 'Host',
          team: 0 as const,
          hand: [],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: true,
          joinedAt: new Date(),
        };
        const comSeat = {
          socketId: 'com-1',
          seatId: asSeatId('seat-com'),
          name: 'COM',
          team: 1 as const,
          hand: [],
          isPasser: true,
          isCOM: true,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: false,
          isHost: false,
          joinedAt: new Date(),
        };
        const roomState = bindRoomRepositoryToState({
          ...baseRoom,
          id: roomId,
          hostSeatId: host.seatId,
          status: RoomStatus.WAITING,
          players: [host, comSeat],
        });

        const joined = await roomService.joinRoom(roomId, {
          socketId: 'socket-new',
          seatId: asSeatId('user-new'),
          userId: 'user-new',
          isAuthenticated: true,
          name: 'New Player',
        });

        expect(joined).toBe(true);
        expect(roomState.getPersistedRoom()?.players[1]).toEqual(
          expect.objectContaining({
            seatId: comSeat.seatId,
            userId: 'user-new',
            name: 'New Player',
            isCOM: false,
          }),
        );
      });

      it('does not let a newcomer replace a timeout-owned COM seat', async () => {
        const roomId = 'room-reserved-timeout-seat';
        const host: RoomPlayer = {
          socketId: 'socket-host',
          seatId: asSeatId('seat-host'),
          userId: 'user-host',
          isAuthenticated: true,
          name: 'Host',
          team: 0,
          hand: [],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: true,
          joinedAt: new Date(),
        };
        const timeoutSeat: RoomPlayer = {
          socketId: '',
          seatId: asSeatId('seat-timeout'),
          userId: 'user-disconnected',
          isAuthenticated: true,
          participantKey: 'user-disconnected',
          name: 'COM',
          team: 1,
          hand: [],
          isPasser: false,
          isCOM: true,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: false,
          isHost: false,
          joinedAt: new Date(),
        };
        const roomState = bindRoomRepositoryToState({
          ...baseRoom,
          id: roomId,
          hostSeatId: asSeatId(host.seatId),
          status: RoomStatus.WAITING,
          settings: { ...baseRoom.settings, maxPlayers: 2 },
          players: [host, timeoutSeat],
        });

        const joined = await roomService.joinRoom(roomId, {
          socketId: 'socket-new',
          seatId: asSeatId('user-new'),
          userId: 'user-new',
          isAuthenticated: true,
          name: 'New Player',
        });

        expect(joined).toBe(false);
        expect(roomState.getPersistedRoom()?.players[1]).toEqual(timeoutSeat);
      });

      it('adds a newcomer without overwriting a reserved COM game state', async () => {
        const roomId = 'room-reserved-seat-with-capacity';
        const host = makeRoomPlayer('seat-host', 'Host', 0, {
          userId: 'user-host',
          isAuthenticated: true,
          isHost: true,
        });
        const timeoutSeat = makeRoomPlayer('seat-timeout', 'COM', 1, {
          userId: 'user-disconnected',
          isAuthenticated: true,
          participantKey: 'user-disconnected',
          isCOM: true,
        });
        const roomState = bindRoomRepositoryToState({
          ...baseRoom,
          id: roomId,
          hostSeatId: asSeatId(host.seatId),
          status: RoomStatus.PLAYING,
          settings: { ...baseRoom.settings, maxPlayers: 3 },
          players: [host, timeoutSeat],
        });
        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().gamePhase = 'play';
        gameState.getState().players = [
          makeGamePlayer(host.seatId, host.name, host.team),
          makeGamePlayer(
            timeoutSeat.seatId,
            timeoutSeat.name,
            timeoutSeat.team,
            {
              isCOM: true,
            },
          ),
        ];

        const joined = await roomService.joinRoom(roomId, {
          socketId: 'socket-new',
          seatId: asSeatId('user-new'),
          userId: 'user-new',
          isAuthenticated: true,
          name: 'New Player',
        });

        expect(joined).toBe(true);
        expect(roomState.getPersistedRoom()?.players).toHaveLength(3);
        expect(
          gameState
            .getState()
            .players.find((player) => player.seatId === timeoutSeat.seatId),
        ).toEqual(expect.objectContaining({ isCOM: true }));
        expect(
          gameState
            .getState()
            .players.find((player) => player.name === 'New Player'),
        ).toEqual(expect.objectContaining({ isCOM: false }));
      });

      it('restores the owner of an in-memory vacant seat as a human', async () => {
        const roomId = 'room-vacant-owner';
        const seatId = asSeatId('seat-owner');
        const timeoutCOM: RoomPlayer = {
          socketId: 'com-timeout',
          seatId: asSeatId(seatId),
          name: 'COM',
          team: 0,
          hand: ['H2'],
          isPasser: false,
          isCOM: true,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: true,
          joinedAt: new Date(),
        };
        const roomState = bindRoomRepositoryToState({
          ...baseRoom,
          id: roomId,
          hostSeatId: asSeatId(seatId),
          status: RoomStatus.PLAYING,
          players: [timeoutCOM],
        });
        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().gamePhase = 'play';
        gameState.getState().players = [
          makeGamePlayer(seatId, 'COM', 0, {
            hand: ['H2'],
            isCOM: true,
          }),
        ];
        (
          roomService as unknown as {
            vacantSeats: Record<string, Record<string, unknown>>;
          }
        ).vacantSeats[roomId] = {
          [seatId]: {
            roomPlayer: {
              ...timeoutCOM,
              socketId: '',
              userId: 'user-owner',
              isAuthenticated: true,
              participantKey: 'user-owner',
              name: 'Owner',
              isCOM: false,
            },
          },
        };

        const joined = await roomService.joinRoom(roomId, {
          socketId: 'socket-owner',
          seatId: asSeatId('stale-player-id'),
          userId: 'user-owner',
          isAuthenticated: true,
          name: 'Owner',
        });

        expect(joined).toBe(true);
        expect(roomState.getPersistedRoom()?.players[0]).toEqual(
          expect.objectContaining({
            seatId: seatId,
            userId: 'user-owner',
            name: 'Owner',
            isCOM: false,
          }),
        );
        expect(gameState.getState().players[0]?.isCOM).toBe(false);
        expect(
          (
            roomService as unknown as {
              vacantSeats: Record<string, unknown>;
            }
          ).vacantSeats[roomId],
        ).toBeUndefined();
      });

      it('should restore same player to their previous seat', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');
        const user = {
          socketId: 'socket-new',
          seatId, // Same seatId
          name: 'Test Player',
        };

        // Setup: player left, vacantSeat exists with their seatId
        const comPlayer: RoomPlayer = {
          socketId: 'com-0',
          seatId: asSeatId(seatId),
          name: 'COM',
          team: 0,
          hand: [],
          isPasser: false,
          hasBroken: false,
          isReady: false,
          isHost: false,
          joinedAt: new Date(),
        };

        const room: Room = {
          ...baseRoom,
          id: roomId,
          players: [comPlayer],
        };

        const roomState = bindRoomRepositoryToState(room);
        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          makeGamePlayer(seatId, 'COM', 0, {
            hand: ['H2', 'D3', 'C4'],
            isCOM: true,
          }),
        ];

        // Manually set vacantSeat (simulating previous leave)

        (roomService as any)['vacantSeats'][roomId] = {
          [seatId]: {
            roomPlayer: {
              socketId: '',
              seatId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3', 'C4'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
              isReady: false,
              isHost: false,
              joinedAt: new Date(),
            },
            gamePlayer: {
              socketId: '',
              seatId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3', 'C4'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
          },
        };

        const result = await roomService.joinRoom(roomId, user);

        expect(result).toBe(true);

        // Verify player was restored to index 0
        const restoredRoom = roomState.getPersistedRoom();
        expect(restoredRoom?.players[0].seatId).toBe(comPlayer.seatId);
        expect(restoredRoom?.players[0].hand).toEqual([]);
        const restoredState = await roomService.getRoomGameState(roomId);
        expect(restoredState.getState().players[0].hand).toEqual([
          'H2',
          'D3',
          'C4',
        ]);
        expect(restoredRoom?.players[0].team).toBe(0);
      });

      it('should allow an existing player to rejoin a full waiting room', async () => {
        const roomId = 'room-123';
        const existingPlayer: RoomPlayer = {
          socketId: 'socket-old',
          seatId: asSeatId('player-1'),
          userId: 'user-1',
          isAuthenticated: true,
          name: 'Test Player',
          team: 0,
          hand: [],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: true,
          joinedAt: new Date(),
        };
        const roomState = bindRoomRepositoryToState({
          ...baseRoom,
          id: roomId,
          status: RoomStatus.WAITING,
          settings: { ...baseRoom.settings, maxPlayers: 1 },
          players: [existingPlayer],
        });

        const result = await roomService.joinRoom(roomId, {
          socketId: 'socket-new',
          seatId: asSeatId('stale-player'),
          userId: 'user-1',
          isAuthenticated: true,
          name: 'Test Player',
        });

        expect(result).toBe(true);
        expect(roomState.getPersistedRoom()?.players[0].seatId).toBe(
          'player-1',
        );
        expect(roomState.getPersistedRoom()?.players[0].socketId).toBe('');
        expect(gameStateRepository.persistRoomRoster).toHaveBeenCalledWith(
          roomId,
          [expect.objectContaining({ seatId: asSeatId('player-1') })],
          expect.objectContaining({
            players: [
              expect.objectContaining({ seatId: asSeatId('player-1') }),
            ],
          }),
          'player-1',
          expect.objectContaining({
            type: 'claim',
            userId: 'user-1',
          }),
        );
      });

      it('should preserve host status when the room host replaces a COM placeholder', async () => {
        const roomId = 'room-123';
        const hostUser = {
          socketId: 'socket-host',
          seatId: asSeatId('player-1'),
          name: 'Host Player',
        };

        const comPlayer: RoomPlayer = {
          socketId: 'com-0',
          seatId: asSeatId('com-0'),
          name: 'COM',
          team: 0,
          hand: [],
          isPasser: false,
          isCOM: true,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: false,
          isHost: false,
          joinedAt: new Date(),
        };

        const room: Room = {
          ...baseRoom,
          hostSeatId: asSeatId(comPlayer.seatId),
          status: RoomStatus.WAITING,
          players: [comPlayer],
        };

        roomRepository.findById.mockResolvedValue(room);

        const result = await roomService.joinRoom(roomId, hostUser);

        expect(result).toBe(true);
        expect(gameStateRepository.persistRoomRoster).toHaveBeenCalledWith(
          roomId,
          [
            expect.objectContaining({
              seatId: asSeatId('com-0'),
              isHost: true,
            }),
          ],
          expect.any(Object),
          'com-0',
          undefined,
        );
      });

      it('should normalize duplicate host flags based on room.hostSeatId', async () => {
        const roomId = 'room-123';
        const room: Room = {
          ...baseRoom,
          hostSeatId: asSeatId('player-2'),
          players: [
            {
              socketId: 'socket-1',
              seatId: asSeatId('player-1'),
              name: 'Player1',
              team: 0,
              hand: [],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
              isReady: false,
              isHost: true,
              joinedAt: new Date(),
            },
            {
              socketId: 'socket-2',
              seatId: asSeatId('player-2'),
              name: 'Player2',
              team: 1,
              hand: [],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
              isReady: false,
              isHost: true,
              joinedAt: new Date(),
            },
          ] as RoomPlayer[],
        };

        roomRepository.findById.mockResolvedValue(room);

        const normalizedRoom = await roomService.getRoom(roomId);

        expect(
          normalizedRoom?.players.find((player) => player.seatId === 'player-1')
            ?.isHost,
        ).toBe(false);
        expect(
          normalizedRoom?.players.find((player) => player.seatId === 'player-2')
            ?.isHost,
        ).toBe(true);
      });

      it('should restore the correct com seat even when repository order changes', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');
        const user = {
          socketId: 'socket-new',
          seatId,
          name: 'Test Player',
        };

        const otherCom: RoomPlayer = {
          socketId: 'com-other',
          seatId: asSeatId('com-other'),
          name: 'COM',
          team: 1,
          hand: [],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: false,
          isHost: false,
          joinedAt: new Date('2026-03-13T10:00:00.000Z'),
        };

        const targetCom: RoomPlayer = {
          socketId: 'com-target',
          seatId: asSeatId(seatId),
          name: 'COM',
          team: 0,
          hand: [],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: false,
          isHost: false,
          joinedAt: new Date('2026-03-13T10:01:00.000Z'),
        };

        const room: Room = {
          ...baseRoom,
          players: [otherCom, targetCom],
        };

        const roomState = bindRoomRepositoryToState(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            seatId: asSeatId(otherCom.seatId),
            name: otherCom.name,
            team: otherCom.team,
            hand: [],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
            isCOM: true,
          },
          {
            seatId: asSeatId(targetCom.seatId),
            name: targetCom.name,
            team: targetCom.team,
            hand: ['H2', 'D3', 'C4'],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
            isCOM: true,
          },
        ];

        // The current repository order places the vacant seat at index 1.

        (roomService as any)['vacantSeats'][roomId] = {
          [seatId]: {
            roomPlayer: {
              socketId: '',
              seatId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3', 'C4'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
              isReady: false,
              isHost: false,
              joinedAt: new Date(),
            },
            gamePlayer: {
              socketId: '',
              seatId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3', 'C4'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
          },
        };

        const result = await roomService.joinRoom(roomId, user);

        expect(result).toBe(true);
        const updatedRoom = roomState.getPersistedRoom();
        expect(updatedRoom?.players[0].seatId).toBe(otherCom.seatId);
        expect(updatedRoom?.players[1].seatId).toBe(targetCom.seatId);
        expect(updatedRoom?.players[1].hand).toEqual([]);
        expect(gameState.getState().players[0].seatId).toBe(otherCom.seatId);
        expect(gameState.getState().players[1].seatId).toBe(targetCom.seatId);
        expect(gameState.getState().players[1].hand).toEqual([
          'H2',
          'D3',
          'C4',
        ]);
      });

      it('should restore the latest com hand after cards were played while disconnected', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');
        const user = {
          socketId: 'socket-new',
          seatId,
          name: 'Test Player',
        };

        const targetCom: RoomPlayer = {
          socketId: 'com-target',
          seatId: asSeatId(seatId),
          name: 'COM',
          team: 0,
          hand: ['H2', 'D3'],
          isCOM: true,
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date('2026-03-13T10:01:00.000Z'),
        };

        const room: Room = {
          ...baseRoom,
          players: [targetCom],
        };

        const roomState = bindRoomRepositoryToState(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            seatId: asSeatId(targetCom.seatId),
            name: targetCom.name,
            team: targetCom.team,
            hand: ['H2', 'D3'],
            isPasser: true,
            hasBroken: false,
            hasRequiredBroken: false,
            isCOM: true,
          },
        ];

        // Snapshot at leave time still had three cards, but the com has since
        // played one and only holds two.

        (roomService as any)['vacantSeats'][roomId] = {
          [seatId]: {
            roomPlayer: {
              socketId: '',
              seatId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3', 'C4'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
              isReady: true,
              isHost: false,
              joinedAt: new Date(),
            },
            gamePlayer: {
              socketId: '',
              seatId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3', 'C4'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
          },
        };

        const result = await roomService.joinRoom(roomId, user);

        expect(result).toBe(true);
        const updatedRoom = roomState.getPersistedRoom();
        expect(updatedRoom?.players[0].seatId).toBe(targetCom.seatId);
        expect(updatedRoom?.players[0].hand).toEqual([]);
        expect(gameState.getState().players[0].seatId).toBe(targetCom.seatId);
        expect(gameState.getState().players[0].hand).toEqual(['H2', 'D3']);
        expect(gameState.getState().players[0].isPasser).toBe(true);
      });

      it('should keep field references on the stable seat when a player rejoins', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');
        const user = {
          socketId: 'socket-new',
          seatId,
          name: 'Test Player',
        };

        const targetCom: RoomPlayer = {
          socketId: 'com-target',
          seatId: asSeatId(seatId),
          name: 'COM',
          team: 0,
          hand: ['H2', 'D3'],
          isCOM: true,
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date('2026-03-13T10:01:00.000Z'),
        };

        const room: Room = {
          ...baseRoom,
          players: [targetCom],
        };

        roomRepository.findById.mockResolvedValue(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            seatId: asSeatId(targetCom.seatId),
            name: targetCom.name,
            team: targetCom.team,
            hand: ['H2', 'D3'],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
            isCOM: true,
          },
        ];
        gameState.getState().playState = {
          currentField: {
            cards: ['9♥'],
            playedBy: [targetCom.seatId],
            baseCard: '9♥',
            dealerSeatId: asSeatId(targetCom.seatId),
            isComplete: false,
          },
          negriCard: null,
          neguri: { [targetCom.seatId]: '5♦' },
          fields: [
            {
              cards: ['7♣', '8♣', '9♣', '10♣'],
              winnerSeatId: asSeatId(targetCom.seatId),
              winnerTeam: 0,
              dealerSeatId: asSeatId(targetCom.seatId),
            },
          ],
          lastWinnerSeatId: asSeatId(targetCom.seatId),
          openDeclared: false,
          openDeclarerSeatId: asSeatId(targetCom.seatId),
        };
        gameState.getState().pendingBrokenHandReveal = {
          seatId: asSeatId(targetCom.seatId),
          handSnapshot: ['H2', 'D3'],
          startedAt: 100,
        };
        gameState.getState().teamAssignments[targetCom.seatId] = 0;

        (roomService as any)['vacantSeats'][roomId] = {
          [seatId]: {
            roomPlayer: {
              socketId: '',
              seatId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
              isReady: true,
              isHost: false,
              joinedAt: new Date(),
            },
            gamePlayer: {
              socketId: '',
              seatId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
          },
        };

        const result = await roomService.joinRoom(roomId, user);

        expect(result).toBe(true);
        expect(gameState.getState().playState?.currentField?.dealerSeatId).toBe(
          targetCom.seatId,
        );
        expect(gameState.getState().playState?.currentField?.playedBy).toEqual([
          targetCom.seatId,
        ]);
        expect(gameState.getState().playState?.fields[0]?.winnerSeatId).toBe(
          targetCom.seatId,
        );
        expect(gameState.getState().playState?.fields[0]?.dealerSeatId).toBe(
          targetCom.seatId,
        );
        expect(gameState.getState().playState?.lastWinnerSeatId).toBe(
          targetCom.seatId,
        );
        expect(gameState.getState().playState?.openDeclarerSeatId).toBe(
          targetCom.seatId,
        );
        expect(gameState.getState().pendingBrokenHandReveal?.seatId).toBe(
          targetCom.seatId,
        );
        expect(gameState.getState().playState?.neguri[targetCom.seatId]).toBe(
          '5♦',
        );
        expect(gameState.getState().teamAssignments[targetCom.seatId]).toBe(0);
      });

      it('should keep blow references on the stable seat when a player rejoins', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');
        const user = {
          socketId: 'socket-new',
          seatId,
          name: 'Test Player',
        };

        const targetCom: RoomPlayer = {
          socketId: 'com-target',
          seatId: asSeatId(seatId),
          name: 'COM',
          team: 0,
          hand: ['H2', 'D3'],
          isCOM: true,
          isPasser: true,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date('2026-03-13T10:01:00.000Z'),
        };

        const room: Room = {
          ...baseRoom,
          players: [targetCom],
        };

        roomRepository.findById.mockResolvedValue(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            seatId: asSeatId(targetCom.seatId),
            name: targetCom.name,
            team: targetCom.team,
            hand: ['H2', 'D3'],
            isPasser: true,
            hasBroken: false,
            hasRequiredBroken: false,
            isCOM: true,
          },
        ];
        gameState.getState().blowState = {
          currentTrump: null,
          currentHighestDeclaration: {
            seatId: asSeatId(targetCom.seatId),
            trumpType: 'club',
            numberOfPairs: 6,
            timestamp: 1,
          },
          declarations: [
            {
              seatId: asSeatId(targetCom.seatId),
              trumpType: 'club',
              numberOfPairs: 6,
              timestamp: 1,
            },
          ],
          actionHistory: [
            {
              type: 'declare',
              seatId: asSeatId(targetCom.seatId),
              trumpType: 'club',
              numberOfPairs: 6,
              timestamp: 1,
            },
            {
              type: 'pass',
              seatId: asSeatId(targetCom.seatId),
              timestamp: 2,
            },
          ],
          lastPasserSeatId: asSeatId(targetCom.seatId),
          isRoundCancelled: false,
          currentBlowIndex: 0,
        };

        (roomService as any)['vacantSeats'][roomId] = {
          [seatId]: {
            roomPlayer: {
              socketId: '',
              seatId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3'],
              isPasser: true,
              hasBroken: false,
              hasRequiredBroken: false,
              isReady: true,
              isHost: false,
              joinedAt: new Date(),
            },
            gamePlayer: {
              socketId: '',
              seatId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3'],
              isPasser: true,
              hasBroken: false,
              hasRequiredBroken: false,
            },
          },
        };

        const result = await roomService.joinRoom(roomId, user);

        expect(result).toBe(true);
        expect(
          gameState.getState().blowState.currentHighestDeclaration?.seatId,
        ).toBe(targetCom.seatId);
        expect(gameState.getState().blowState.declarations[0]?.seatId).toBe(
          targetCom.seatId,
        );
        expect(
          gameState
            .getState()
            .blowState.actionHistory.map((action) => action.seatId),
        ).toEqual([targetCom.seatId, targetCom.seatId]);
        expect(gameState.getState().blowState.lastPasserSeatId).toBe(
          targetCom.seatId,
        );
      });

      it('should advance blow turn when a joining player replaces a COM that already acted', async () => {
        const roomId = 'room-123';
        const replacingComId = 'com-2';
        const joiningSeatId = 'player-2';
        const nextSeatId = 'player-3';
        const user = {
          socketId: 'socket-new',
          seatId: asSeatId(joiningSeatId),
          name: 'Player 2',
        };
        const comPlayer: RoomPlayer = {
          socketId: 'com-socket',
          seatId: asSeatId(replacingComId),
          name: 'COM 2',
          team: 0,
          hand: ['H2', 'D3'],
          isCOM: true,
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date('2026-03-13T10:01:00.000Z'),
        };
        const nextRoomPlayer: RoomPlayer = {
          socketId: 'socket-3',
          seatId: asSeatId(nextSeatId),
          name: 'Player 3',
          team: 1,
          hand: ['C4', 'S5'],
          isCOM: false,
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date('2026-03-13T10:02:00.000Z'),
        };
        const room: Room = {
          ...baseRoom,
          players: [comPlayer, nextRoomPlayer],
        };

        roomRepository.findById.mockResolvedValue(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameStateRepository.update.mockImplementation(
          async (_roomId, state) => ({
            ...gameState.getState(),
            ...state,
            version: (gameState.getState().version ?? 0) + 1,
          }),
        );
        gameState.getState().gamePhase = 'blow';
        gameState.getState().players = [
          {
            seatId: asSeatId(replacingComId),
            name: 'COM 2',
            team: 0,
            hand: ['H2', 'D3'],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
            isCOM: true,
          },
          {
            seatId: asSeatId(nextSeatId),
            name: 'Player 3',
            team: 1,
            hand: ['C4', 'S5'],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
        ];
        gameState.getState().currentSeatId = asSeatId(replacingComId);
        gameState.getState().blowState = {
          currentTrump: null,
          currentHighestDeclaration: {
            seatId: asSeatId(replacingComId),
            trumpType: 'daiya',
            numberOfPairs: 7,
            timestamp: 1,
          },
          declarations: [
            {
              seatId: asSeatId(replacingComId),
              trumpType: 'daiya',
              numberOfPairs: 7,
              timestamp: 1,
            },
          ],
          actionHistory: [
            {
              type: 'declare',
              seatId: asSeatId(replacingComId),
              trumpType: 'daiya',
              numberOfPairs: 7,
              timestamp: 1,
            },
          ],
          lastPasserSeatId: null,
          isRoundCancelled: false,
          currentBlowIndex: 0,
        };

        const result = await roomService.joinRoom(roomId, user);

        expect(result).toBe(true);
        expect(gameState.getState().players[0]?.seatId).toBe(replacingComId);
        expect(
          gameState.getState().blowState.currentHighestDeclaration?.seatId,
        ).toBe(replacingComId);
        expect(gameState.getState().blowState.declarations[0]?.seatId).toBe(
          replacingComId,
        );
        expect(gameState.getState().currentSeatId).toBe(nextSeatId);
        expect(gameState.getCurrentPlayerIndex()).toBe(1);
        expect(gameStateRepository.update).toHaveBeenCalledWith(
          roomId,
          expect.objectContaining({ currentSeatId: nextSeatId }),
          expect.any(Number),
        );
      });

      it('should inherit the original seat blow action when a different player takes a vacant blow seat', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('seat-left');
        const joiningSeatId = 'player-join';
        const nextSeatId = 'player-next';
        const user = {
          socketId: 'socket-join',
          seatId: asSeatId(joiningSeatId),
          name: 'Joining Player',
        };
        const comPlayer: RoomPlayer = {
          socketId: 'com-socket',
          seatId: asSeatId(seatId),
          name: 'COM',
          team: 0,
          hand: ['H2', 'D3'],
          isCOM: true,
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date('2026-03-13T10:01:00.000Z'),
        };
        const nextRoomPlayer: RoomPlayer = {
          socketId: 'socket-next',
          seatId: asSeatId(nextSeatId),
          name: 'Next Player',
          team: 1,
          hand: ['C4', 'S5'],
          isCOM: false,
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date('2026-03-13T10:02:00.000Z'),
        };
        const room: Room = {
          ...baseRoom,
          players: [comPlayer, nextRoomPlayer],
        };

        roomRepository.findById.mockResolvedValue(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameStateRepository.update.mockImplementation(
          async (_roomId, state) => ({
            ...gameState.getState(),
            ...state,
            version: (gameState.getState().version ?? 0) + 1,
          }),
        );
        gameState.getState().gamePhase = 'blow';
        gameState.getState().players = [
          {
            seatId: asSeatId(seatId),
            name: 'COM',
            team: 0,
            hand: ['H2', 'D3'],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
            isCOM: true,
          },
          {
            seatId: asSeatId(nextSeatId),
            name: 'Next Player',
            team: 1,
            hand: ['C4', 'S5'],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
        ];
        gameState.getState().currentSeatId = asSeatId(seatId);
        gameState.getState().blowState = {
          currentTrump: null,
          currentHighestDeclaration: {
            seatId: asSeatId(seatId),
            trumpType: 'club',
            numberOfPairs: 7,
            timestamp: 1,
          },
          declarations: [
            {
              seatId: asSeatId(seatId),
              trumpType: 'club',
              numberOfPairs: 7,
              timestamp: 1,
            },
          ],
          actionHistory: [
            {
              type: 'declare',
              seatId: asSeatId(seatId),
              trumpType: 'club',
              numberOfPairs: 7,
              timestamp: 1,
            },
          ],
          lastPasserSeatId: null,
          isRoundCancelled: false,
          currentBlowIndex: 0,
        };
        const stalePersistedBlowState = JSON.parse(
          JSON.stringify(gameState.getState().blowState),
        ) as GameState['blowState'];
        gameStateRepository.persistRoomRoster.mockImplementationOnce(
          async (_roomId, _roomPlayers, state) => ({
            ...state,
            currentSeatId: seatId,
            currentPlayerIndex: 0,
            blowState: stalePersistedBlowState,
            version: (state.version ?? 0) + 1,
          }),
        );
        (roomService as any)['vacantSeats'][roomId] = {
          [seatId]: {
            roomPlayer: {
              socketId: 'socket-left',
              seatId: seatId,
              name: 'Left Player',
              team: 0,
              hand: ['H2', 'D3'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
              isReady: true,
              isHost: false,
              joinedAt: new Date('2026-03-13T09:59:00.000Z'),
            },
            gamePlayer: {
              seatId: seatId,
              name: 'Left Player',
              team: 0,
              hand: ['H2', 'D3'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
          },
        };

        const result = await roomService.joinRoom(roomId, user);

        expect(result).toBe(true);
        expect(gameState.getState().players[0]?.seatId).toBe(seatId);
        expect(
          gameState.getState().blowState.currentHighestDeclaration?.seatId,
        ).toBe(seatId);
        expect(gameState.getState().blowState.declarations[0]?.seatId).toBe(
          seatId,
        );
        expect(gameState.getState().blowState.actionHistory[0]?.seatId).toBe(
          seatId,
        );
        expect(gameState.getState().currentSeatId).toBe(nextSeatId);
        expect(gameState.getCurrentPlayerIndex()).toBe(1);
        expect(gameStateRepository.update).toHaveBeenCalledWith(
          roomId,
          expect.objectContaining({ currentSeatId: nextSeatId }),
          expect.any(Number),
        );
        expect(
          gameStateRepository.update.mock.calls.some(
            ([, update]) =>
              update.blowState?.currentHighestDeclaration?.seatId === seatId,
          ),
        ).toBe(true);
      });

      it('should let a different player claim a vacant seat without changing its id', async () => {
        const roomId = 'room-123';
        const originalSeatId = asSeatId('player-1');
        const newUser = {
          socketId: 'socket-2',
          seatId: asSeatId('player-2'),
          name: 'New Player',
        };

        const comPlayer: RoomPlayer = {
          socketId: 'com-0',
          seatId: asSeatId(originalSeatId),
          name: 'COM',
          team: 0,
          hand: [],
          isPasser: false,
          hasBroken: false,
          isReady: false,
          isHost: false,
          joinedAt: new Date(),
        };

        const room: Room = {
          ...baseRoom,
          id: roomId,
          players: [comPlayer],
        };

        const roomState = bindRoomRepositoryToState(room);

        // Setup game state and register original token
        const gameState = await roomService.getRoomGameState(roomId);
        gameState.registerSeatToken(originalSeatId, originalSeatId);

        (roomService as any)['vacantSeats'][roomId] = {
          [originalSeatId]: {
            roomPlayer: {
              socketId: '',
              seatId: originalSeatId,
              name: 'Test Player',
              team: 1,
              hand: ['H2', 'D3'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
              isReady: false,
              isHost: false,
              joinedAt: new Date(),
            },
            gamePlayer: {
              socketId: '',
              seatId: originalSeatId,
              name: 'Test Player',
              team: 1,
              hand: ['H2', 'D3'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
          },
        };

        const result = await roomService.joinRoom(roomId, newUser);

        expect(result).toBe(true);

        // New player should get the seat
        const updatedRoom = roomState.getPersistedRoom();
        expect(updatedRoom?.players[0].seatId).toBe(comPlayer.seatId);
        expect(updatedRoom?.players[0].participantKey).toBe('player-2');
        expect(updatedRoom?.players[0].hand).toEqual([]);
        expect(gameState.getState().players[0].hand).toEqual(['H2', 'D3']);

        expect(gameState.getState().players[0]).toEqual(
          expect.objectContaining({
            seatId: originalSeatId,
            name: 'New Player',
            isCOM: false,
          }),
        );
      });
    });

    it('restores a timeout-owned COM seat and clears the in-memory snapshot', async () => {
      const roomId = 'room-timeout-reconnect';
      const seatId = asSeatId('seat-timeout');
      const roomState = bindRoomRepositoryToState({
        ...baseRoom,
        id: roomId,
        hostSeatId: asSeatId(seatId),
        status: RoomStatus.PLAYING,
        players: [
          {
            socketId: '',
            seatId: asSeatId(seatId),
            userId: 'user-1',
            isAuthenticated: true,
            participantKey: 'user-1',
            name: 'COM',
            team: 0,
            hand: ['A♠'],
            isPasser: false,
            isCOM: true,
            hasBroken: false,
            hasRequiredBroken: false,
            isReady: true,
            isHost: true,
            joinedAt: new Date(),
          },
        ],
      });
      const gameState = await roomService.getRoomGameState(roomId);
      gameState.getState().players = [
        makeGamePlayer(seatId, 'COM', 0, {
          hand: ['A♠'],
          isCOM: true,
        }),
      ];
      (
        roomService as unknown as { vacantSeats: Record<string, unknown> }
      ).vacantSeats[roomId] = {
        [seatId]: {
          roomPlayer: {
            ...roomState.getPersistedRoom()!.players[0],
            name: 'Original Player',
          },
        },
      };

      const result = await roomService.handlePlayerReconnection(
        roomId,
        seatId,
        'socket-new',
        'user-1',
        'Original Player',
      );

      expect(result).toEqual({ success: true });
      expect(roomState.getPersistedRoom()?.players[0]).toEqual(
        expect.objectContaining({
          seatId: asSeatId(seatId),
          userId: 'user-1',
          name: 'Original Player',
          isCOM: false,
        }),
      );
      expect(gameState.getState().players[0]).toEqual(
        expect.objectContaining({ name: 'Original Player', isCOM: false }),
      );
      expect(
        (roomService as unknown as { vacantSeats: Record<string, unknown> })
          .vacantSeats[roomId],
      ).toBeUndefined();
    });

    describe('restorePlayerFromVacantSeat', () => {
      it('should restore stored player snapshot into room and game state', async () => {
        const roomId = 'room-restore';
        const seatId = asSeatId('player-restore');

        const comPlayer: RoomPlayer = {
          socketId: 'com-0',
          seatId: asSeatId(seatId),
          name: 'COM',
          team: 0,
          hand: [],
          isCOM: true,
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: false,
          isHost: false,
          joinedAt: new Date(),
        };

        const room: Room = {
          ...baseRoom,
          id: roomId,
          players: [comPlayer],
        };

        const roomState = bindRoomRepositoryToState(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            seatId: asSeatId(seatId),
            name: 'COM',
            team: 0,
            hand: [],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
        ];

        const roomSnapshot: RoomPlayer = {
          socketId: '',
          seatId: asSeatId(seatId),
          name: 'Restore Player',
          team: 1,
          hand: ['H2', 'D3'],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: false,
          isHost: false,
          joinedAt: new Date(),
        };

        const gameSnapshot = {
          socketId: '',
          seatId,
          name: 'Restore Player',
          team: 1,
          hand: ['H2', 'D3'],
          isPasser: true,
          hasBroken: true,
          hasRequiredBroken: false,
        };

        (roomService as any)['vacantSeats'][roomId] = {
          [seatId]: {
            roomPlayer: roomSnapshot,
            gamePlayer: gameSnapshot,
          },
        };

        const restored = await roomService.restorePlayerFromVacantSeat(
          roomId,
          seatId,
        );

        expect(restored).toBe(true);
        const updatedRoom = roomState.getPersistedRoom();
        expect(updatedRoom?.players[0].seatId).toBe(comPlayer.seatId);
        expect(updatedRoom?.players[0].hand).toEqual([]);
        expect(gameState.getState().players[0].seatId).toBe(comPlayer.seatId);
        expect(gameState.getState().players[0].hand).toEqual(['H2', 'D3']);
        expect(gameState.getState().players[0].isPasser).toBe(true);
        expect((roomService as any)['vacantSeats'][roomId]).toBeUndefined();
      });
    });

    describe('leaveRoom token preservation', () => {
      it('should preserve team when replacing a leaving waiting-room player with a COM placeholder', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-2');

        const hostPlayer: RoomPlayer = {
          socketId: 'socket-1',
          seatId: asSeatId('player-1'),
          name: 'Host Player',
          team: 0,
          hand: [],
          isPasser: false,
          hasBroken: false,
          isReady: true,
          isHost: true,
          joinedAt: new Date(),
        };
        const leavingPlayer: RoomPlayer = {
          socketId: 'socket-2',
          seatId: asSeatId(seatId),
          name: 'Leaving Player',
          team: 1,
          hand: [],
          isPasser: false,
          hasBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date(),
        };
        const comPlayer2: RoomPlayer = {
          ...leavingPlayer,
          socketId: 'com-2',
          seatId: asSeatId('com-2'),
          name: 'COM',
          team: 0,
          isCOM: true,
          isReady: false,
        };
        const comPlayer3: RoomPlayer = {
          ...comPlayer2,
          socketId: 'com-3',
          seatId: asSeatId('com-3'),
          team: 1,
        };

        const room: Room = {
          ...baseRoom,
          status: RoomStatus.WAITING,
          players: [hostPlayer, comPlayer2, comPlayer3, leavingPlayer],
        };

        const roomState = bindRoomRepositoryToState(room);
        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            seatId: asSeatId(hostPlayer.seatId),
            name: hostPlayer.name,
            team: hostPlayer.team,
            hand: [],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
          {
            seatId: asSeatId(leavingPlayer.seatId),
            name: leavingPlayer.name,
            team: leavingPlayer.team,
            hand: [],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
          makeGamePlayer(comPlayer2.seatId, comPlayer2.name, comPlayer2.team, {
            isCOM: true,
            isPasser: true,
          }),
          makeGamePlayer(comPlayer3.seatId, comPlayer3.name, comPlayer3.team, {
            isCOM: true,
            isPasser: true,
          }),
        ];
        gameState.getState().teamAssignments = {
          [hostPlayer.seatId]: hostPlayer.team,
          [leavingPlayer.seatId]: leavingPlayer.team,
          [comPlayer2.seatId]: comPlayer2.team,
          [comPlayer3.seatId]: comPlayer3.team,
        };

        await roomService.leaveRoom(roomId, seatId);

        const updatedRoom = roomState.getPersistedRoom();
        const replacementCom = updatedRoom?.players.find(
          (player) => player.seatId === seatId,
        );
        expect(
          new Set(updatedRoom?.players.map((player) => player.seatId)).size,
        ).toBe(4);
        expect(replacementCom?.team).toBe(1);
        expect(gameState.getState().players[1].seatId).toBe(
          replacementCom?.seatId,
        );
        expect(gameState.getState().players[1].team).toBe(1);
        expect(
          gameState.getState().teamAssignments[replacementCom?.seatId ?? ''],
        ).toBe(1);
        expect(gameState.getState().teamAssignments[seatId]).toBe(1);
      });

      it('should avoid duplicate COM player ids when waiting-room state order is stale', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-2');

        const hostPlayer: RoomPlayer = {
          socketId: 'socket-1',
          seatId: asSeatId('player-1'),
          name: 'Host Player',
          team: 0,
          hand: [],
          isPasser: false,
          hasBroken: false,
          isReady: true,
          isHost: true,
          joinedAt: new Date(),
        };
        const leavingPlayer: RoomPlayer = {
          socketId: 'socket-2',
          seatId: asSeatId(seatId),
          name: 'Leaving Player',
          team: 1,
          hand: [],
          isPasser: false,
          hasBroken: false,
          isReady: true,
          isHost: false,
          joinedAt: new Date(),
        };
        const comPlayer2: RoomPlayer = {
          ...leavingPlayer,
          socketId: 'com-2',
          seatId: asSeatId('com-2'),
          name: 'COM',
          team: 0,
          isCOM: true,
          isReady: false,
        };
        const comPlayer3: RoomPlayer = {
          ...comPlayer2,
          socketId: 'com-3',
          seatId: asSeatId('com-3'),
          team: 1,
        };

        const room: Room = {
          ...baseRoom,
          status: RoomStatus.WAITING,
          players: [hostPlayer, leavingPlayer, comPlayer2, comPlayer3],
        };

        const roomState = bindRoomRepositoryToState(room);
        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          makeGamePlayer(hostPlayer.seatId, hostPlayer.name, hostPlayer.team),
          makeGamePlayer(comPlayer2.seatId, comPlayer2.name, comPlayer2.team, {
            isCOM: true,
            isPasser: true,
          }),
          makeGamePlayer(
            leavingPlayer.seatId,
            leavingPlayer.name,
            leavingPlayer.team,
          ),
          makeGamePlayer(comPlayer3.seatId, comPlayer3.name, comPlayer3.team, {
            isCOM: true,
            isPasser: true,
          }),
        ];

        await roomService.leaveRoom(roomId, seatId);

        const updatedRoom = roomState.getPersistedRoom();
        const seatIds = updatedRoom?.players.map((player) => player.seatId);
        expect(seatIds).toContain(seatId);
        expect(new Set(seatIds).size).toBe(seatIds?.length);
        expect(gameState.getState().players[2].seatId).toBe(seatId);
      });

      it('should not remove reconnectToken when leaving during play', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');

        const player: RoomPlayer = {
          socketId: 'socket-1',
          seatId: asSeatId('player-1'),
          name: 'Test Player',
          team: 0,
          hand: ['H2', 'D3'],
          isPasser: false,
          hasBroken: false,
          isReady: true,
          isHost: true,
          joinedAt: new Date(),
        };

        const room: Room = {
          ...baseRoom,
          status: RoomStatus.PLAYING,
          players: [player],
        };

        bindRoomRepositoryToState(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.registerSeatToken(seatId, seatId);
        gameState.getState().players.push({
          seatId: asSeatId('player-1'),
          name: 'Test Player',
          team: 0,
          hand: ['H2', 'D3'],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
        });

        await roomService.leaveRoom(roomId, seatId);

        expect(gameState.findPlayerByReconnectToken(seatId)?.seatId).toBe(
          seatId,
        );
      });

      it('should preserve blow-phase acted state when replacing a leaving player with COM', async () => {
        const roomId = 'room-123';
        const seatId = asSeatId('player-1');

        const player: RoomPlayer = {
          socketId: 'socket-1',
          seatId: asSeatId(seatId),
          name: 'Test Player',
          team: 0,
          hand: ['H2', 'D3'],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          isReady: true,
          isHost: true,
          joinedAt: new Date(),
        };

        const room: Room = {
          ...baseRoom,
          status: RoomStatus.PLAYING,
          players: [player],
        };

        roomRepository.findById.mockResolvedValue(room);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().gamePhase = 'blow';
        gameState.getState().players = [
          {
            seatId: asSeatId(seatId),
            name: player.name,
            team: player.team,
            hand: [...player.hand],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
        ];

        await roomService.leaveRoom(roomId, seatId);

        expect(gameState.getState().players[0].isCOM).toBe(true);
        expect(gameState.getState().players[0].isPasser).toBe(false);
      });
    });

    describe('5-Minute Timeout Logic', () => {
      it('should convert player to com after timeout callback', async () => {
        const roomId = 'test-room';
        const seatId = asSeatId('player-1');

        // Mock the room to be in playing status
        const roomState = bindRoomRepositoryToState({
          ...baseRoom,
          id: roomId,
          status: RoomStatus.PLAYING,
          players: [
            {
              socketId: 'socket-1',
              seatId: asSeatId(seatId),
              name: 'Player 1',
              hand: [],
              team: 0,
              isReady: true,
              isHost: false,
              joinedAt: new Date(),
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            } as RoomPlayer,
          ],
        });

        // Execute convertPlayerToCOM
        const result = await roomService.convertPlayerToCOM(roomId, seatId);

        expect(result).toBe(true);

        // Verify player was converted to com
        const comPlayer = roomState
          .getPersistedRoom()
          ?.players.find((player) => player.seatId === seatId);
        expect(comPlayer).toBeDefined();
        expect(comPlayer?.isCOM).toBe(true);

        // Verify vacantSeats contains the player's data
        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
        expect((roomService as any)['vacantSeats'][roomId]).toBeDefined();
        expect(
          Object.keys((roomService as any)['vacantSeats'][roomId]),
        ).toEqual([seatId]);
        const vacantSeat = Object.values(
          (roomService as any)['vacantSeats'][roomId],
        )[0] as any;
        expect(vacantSeat.roomPlayer.seatId).toBe(seatId);
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
      });
    });
  });
});
