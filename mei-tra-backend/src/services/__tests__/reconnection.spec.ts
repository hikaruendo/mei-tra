import { GameStateService } from '../game-state.service';
import { RoomService } from '../room.service';
import { IGameStateRepository } from '../../repositories/interfaces/game-state.repository.interface';
import { IRoomRepository } from '../../repositories/interfaces/room.repository.interface';
import { IUserProfileRepository } from '../../repositories/interfaces/user-profile.repository.interface';
import { GameStateFactory } from '../game-state.factory';
import { GameState, Player, TrumpType } from '../../types/game.types';
import { Room, RoomStatus, RoomPlayer } from '../../types/room.types';
import { CardService } from '../card.service';
import { ChomboService } from '../chombo.service';
import { PlayService } from '../play.service';
import { IComPlayerService } from '../interfaces/com-player-service.interface';

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
        update: jest.fn(),
        delete: jest.fn(),
        updateCurrentPlayerIndex: jest.fn(),
        updatePlayers: jest.fn(),
        updatePlayer: jest.fn(),
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

    describe('registerPlayerToken', () => {
      it('should register player token in playerIds map', () => {
        const token = 'test-token-123';
        const playerId = 'player-1';

        gameStateService.registerPlayerToken(token, playerId);

        // Verify by trying to find player by token
        const player: Player = {
          id: 'socket-1',
          playerId: 'player-1',
          name: 'Test Player',
          team: 0,
          hand: [],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
        };

        // Add player to state first
        gameStateService.getState().players.push(player);

        const foundPlayer = gameStateService.findPlayerByReconnectToken(token);
        expect(foundPlayer).toBeTruthy();
        expect(foundPlayer?.playerId).toBe(playerId);
      });

      it('should overwrite existing token', () => {
        const token = 'test-token';
        const playerId1 = 'player-1';
        const playerId2 = 'player-2';

        gameStateService.registerPlayerToken(token, playerId1);
        gameStateService.registerPlayerToken(token, playerId2);

        const player1: Player = {
          id: 'socket-1',
          playerId: 'player-1',
          name: 'Player 1',
          team: 0,
          hand: [],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
        };

        const player2: Player = {
          id: 'socket-2',
          playerId: 'player-2',
          name: 'Player 2',
          team: 1,
          hand: [],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
        };

        gameStateService.getState().players.push(player1, player2);

        const foundPlayer = gameStateService.findPlayerByReconnectToken(token);
        expect(foundPlayer?.playerId).toBe(playerId2);
      });
    });

    describe('removePlayerToken', () => {
      it('should remove player token from playerIds map', () => {
        const token = 'test-token';
        const playerId = 'player-1';

        const player: Player = {
          id: 'socket-1',
          playerId: 'player-1',
          name: 'Test Player',
          team: 0,
          hand: [],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
        };
        gameStateService.getState().players.push(player);

        gameStateService.registerPlayerToken(token, playerId);

        // Token should find player
        expect(
          gameStateService.findPlayerByReconnectToken(token)?.playerId,
        ).toBe(playerId);

        // Remove token
        gameStateService.removePlayerToken(playerId);

        // Should still find by fallback (playerId directly in players array)
        const foundPlayer =
          gameStateService.findPlayerByReconnectToken(playerId);
        expect(foundPlayer?.playerId).toBe(playerId);
      });

      it('should only remove token for specified player', () => {
        const token1 = 'token-1';
        const token2 = 'token-2';
        const playerId1 = 'player-1';
        const playerId2 = 'player-2';

        const player1: Player = {
          id: 'socket-1',
          playerId: 'player-1',
          name: 'Player 1',
          team: 0,
          hand: [],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
        };

        const player2: Player = {
          id: 'socket-2',
          playerId: 'player-2',
          name: 'Player 2',
          team: 1,
          hand: [],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
        };

        gameStateService.getState().players.push(player1, player2);

        gameStateService.registerPlayerToken(token1, playerId1);
        gameStateService.registerPlayerToken(token2, playerId2);

        // Remove token1
        gameStateService.removePlayerToken(playerId1);

        // Token1 should be removed, but can still find by playerId fallback
        expect(
          gameStateService.findPlayerByReconnectToken(playerId1)?.playerId,
        ).toBe(playerId1); // Fallback works

        // Token2 should still exist
        expect(
          gameStateService.findPlayerByReconnectToken(token2)?.playerId,
        ).toBe(playerId2);
      });
    });

    describe('loadState', () => {
      it('should rebuild playerIds map from persisted players', async () => {
        const roomId = 'room-123';
        const persistedState: GameState = {
          players: [
            {
              id: 'socket-1',
              playerId: 'player-1',
              name: 'Player 1',
              team: 0,
              hand: ['H2', 'D3'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
            {
              id: 'socket-2',
              playerId: 'player-2',
              name: 'Player 2',
              team: 1,
              hand: ['C4', 'S5'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
          ],
          currentPlayerIndex: 0,
          gamePhase: 'play',
          deck: [],
          blowState: {
            currentTrump: null,
            currentHighestDeclaration: null,
            declarations: [],
            actionHistory: [],
            lastPasser: null,
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

        // Verify playerIds map was rebuilt
        const foundPlayer1 =
          gameStateService.findPlayerByReconnectToken('player-1');
        const foundPlayer2 =
          gameStateService.findPlayerByReconnectToken('player-2');

        expect(foundPlayer1?.playerId).toBe('player-1');
        expect(foundPlayer2?.playerId).toBe('player-2');
      });

      it('should handle empty players array', async () => {
        const roomId = 'room-empty';
        const persistedState: GameState = {
          players: [],
          currentPlayerIndex: -1,
          gamePhase: null,
          deck: [],
          blowState: {
            currentTrump: null,
            currentHighestDeclaration: null,
            declarations: [],
            actionHistory: [],
            lastPasser: null,
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
      hostId: 'player-1',
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
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        addPlayer: jest.fn(),
        removePlayer: jest.fn(),
        updatePlayer: jest.fn(),
        findRoomsOlderThan: jest.fn(),
        findByStatus: jest.fn(),
        findByHostId: jest.fn(),
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
        update: jest.fn(),
        delete: jest.fn(),
        updateCurrentPlayerIndex: jest.fn(),
        updatePlayers: jest.fn(),
        updatePlayer: jest.fn(),
        updateGamePhase: jest.fn(),
        bulkUpdate: jest.fn(),
        deleteExpiredGameStates: jest.fn(),
      } as jest.Mocked<IGameStateRepository>;

      const cardService = new CardService();
      const playService = new PlayService(cardService);
      const chomboService = new ChomboService(playService);
      const comPlayerService: jest.Mocked<IComPlayerService> = {
        createComPlayer: jest.fn(),
        selectBestCard: jest.fn(),
        selectBaseSuit: jest.fn(
          (_hand: string[], _trump: TrumpType | null) => '♠',
        ),
        isComPlayer: jest.fn(),
      };
      gameStateFactory = new GameStateFactory(
        cardService,
        chomboService,
        gameStateRepository,
      );

      roomService = new RoomService(
        roomRepository,
        userProfileRepository,
        gameStateFactory,
        comPlayerService,
      );
    });

    describe('convertPlayerToCOM', () => {
      it('should convert player to com and save to vacantSeats', async () => {
        const roomId = 'room-123';
        const playerId = 'player-1';

        const player: RoomPlayer = {
          id: 'socket-1',
          playerId: 'player-1',
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
        roomRepository.removePlayer.mockResolvedValue(true);
        roomRepository.addPlayer.mockResolvedValue(true);

        const result = await roomService.convertPlayerToCOM(roomId, playerId);

        expect(result).toBe(true);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(roomRepository.removePlayer).toHaveBeenCalledWith(
          roomId,
          playerId,
        );
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(roomRepository.addPlayer).toHaveBeenCalled();

        // Verify com player was created
        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        const addPlayerCall = (roomRepository.addPlayer as jest.Mock).mock
          .calls[0][1];
        expect(addPlayerCall.playerId).toContain('com-');
        expect(addPlayerCall.name).toBe('COM');
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      });

      it('should keep reconnectToken when converting to com', async () => {
        const roomId = 'room-123';
        const playerId = 'player-1';

        const player: RoomPlayer = {
          id: 'socket-1',
          playerId: 'player-1',
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
        roomRepository.removePlayer.mockResolvedValue(true);
        roomRepository.addPlayer.mockResolvedValue(true);

        // Register token first
        const gameState = await roomService.getRoomGameState(roomId);
        gameState.registerPlayerToken(playerId, playerId);

        await roomService.convertPlayerToCOM(roomId, playerId);

        // Token should still exist in the map (not removed)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const tokenMap = (gameState as any)['playerIds'];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        expect(tokenMap.has(playerId)).toBe(true);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        expect(tokenMap.get(playerId)).toBe(playerId);
      });

      it('should remap current play state references to the COM player', async () => {
        const roomId = 'room-123';
        const playerId = 'player-1';

        const player: RoomPlayer = {
          id: 'socket-1',
          playerId,
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
        roomRepository.removePlayer.mockResolvedValue(true);
        roomRepository.addPlayer.mockResolvedValue(true);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            id: player.id,
            playerId,
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
            baseCard: 'JOKER',
            dealerId: playerId,
            isComplete: false,
          },
          negriCard: null,
          neguri: { [playerId]: '9♣' },
          fields: [
            {
              cards: ['7♣', '8♣', '9♣', '10♣'],
              winnerId: playerId,
              winnerTeam: 0,
              dealerId: playerId,
            },
          ],
          lastWinnerId: playerId,
          openDeclared: false,
          openDeclarerId: playerId,
        };
        gameState.getState().teamAssignments[playerId] = 0;

        const result = await roomService.convertPlayerToCOM(roomId, playerId);

        expect(result).toBe(true);
        const comPlayerId = gameState.getState().players[0].playerId;
        expect(comPlayerId).toContain('com-');
        expect(gameState.getState().playState?.currentField?.dealerId).toBe(
          comPlayerId,
        );
        expect(gameState.getState().playState?.fields[0]?.winnerId).toBe(
          comPlayerId,
        );
        expect(gameState.getState().playState?.fields[0]?.dealerId).toBe(
          comPlayerId,
        );
        expect(gameState.getState().playState?.lastWinnerId).toBe(comPlayerId);
        expect(gameState.getState().playState?.openDeclarerId).toBe(comPlayerId);
        expect(gameState.getState().playState?.neguri[comPlayerId]).toBe('9♣');
        expect(gameState.getState().teamAssignments[playerId]).toBeUndefined();
        expect(gameState.getState().teamAssignments[comPlayerId]).toBe(0);
      });

      it('should return false if room not found', async () => {
        roomRepository.findById.mockResolvedValue(null);

        const result = await roomService.convertPlayerToCOM(
          'missing-room',
          'player-1',
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
          'missing-player',
        );

        expect(result).toBe(false);
      });
    });

    describe('joinRoom with playerId matching', () => {
      it('should restore same player to their previous seat', async () => {
        const roomId = 'room-123';
        const playerId = 'player-1';
        const user = {
          id: 'socket-new',
          playerId, // Same playerId
          name: 'Test Player',
        };

        // Setup: player left, vacantSeat exists with their playerId
        const comPlayer: RoomPlayer = {
          id: 'com-0',
          playerId: 'com-0',
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
          players: [comPlayer],
        };

        roomRepository.findById.mockResolvedValue(room);
        roomRepository.removePlayer.mockResolvedValue(true);
        roomRepository.addPlayer.mockResolvedValue(true);

        // Manually set vacantSeat (simulating previous leave)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (roomService as any)['vacantSeats'][roomId] = {
          0: {
            roomPlayer: {
              id: '',
              playerId,
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
              id: '',
              playerId,
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
        expect(room.players[0].playerId).toBe(playerId);
        expect(room.players[0].hand).toEqual(['H2', 'D3', 'C4']);
        expect(room.players[0].team).toBe(0);
      });

      it('should restore the correct com seat even when repository order changes', async () => {
        const roomId = 'room-123';
        const playerId = 'player-1';
        const user = {
          id: 'socket-new',
          playerId,
          name: 'Test Player',
        };

        const otherCom: RoomPlayer = {
          id: 'com-other',
          playerId: 'com-other',
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
          id: 'com-target',
          playerId: 'com-target',
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

        roomRepository.findById.mockResolvedValue(room);
        roomRepository.removePlayer.mockResolvedValue(true);
        roomRepository.addPlayer.mockResolvedValue(true);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            id: otherCom.id,
            playerId: otherCom.playerId,
            name: otherCom.name,
            team: otherCom.team,
            hand: [],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
            isCOM: true,
          },
          {
            id: targetCom.id,
            playerId: targetCom.playerId,
            name: targetCom.name,
            team: targetCom.team,
            hand: ['H2', 'D3', 'C4'],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
            isCOM: true,
          },
        ];

        // Simulate a stored vacant seat that used to be index 0, while the
        // current repository order now places the replacement com at index 1.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (roomService as any)['vacantSeats'][roomId] = {
          0: {
            roomPlayer: {
              id: '',
              playerId,
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
              id: '',
              playerId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3', 'C4'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
            replacementPlayerId: targetCom.playerId,
          },
        };

        const result = await roomService.joinRoom(roomId, user);

        expect(result).toBe(true);
        expect(room.players[0].playerId).toBe(otherCom.playerId);
        expect(room.players[1].playerId).toBe(playerId);
        expect(room.players[1].hand).toEqual(['H2', 'D3', 'C4']);
        expect(gameState.getState().players[0].playerId).toBe(
          otherCom.playerId,
        );
        expect(gameState.getState().players[1].playerId).toBe(playerId);
      });

      it('should restore the latest com hand after cards were played while disconnected', async () => {
        const roomId = 'room-123';
        const playerId = 'player-1';
        const user = {
          id: 'socket-new',
          playerId,
          name: 'Test Player',
        };

        const targetCom: RoomPlayer = {
          id: 'com-target',
          playerId: 'com-target',
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
        roomRepository.removePlayer.mockResolvedValue(true);
        roomRepository.addPlayer.mockResolvedValue(true);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            id: targetCom.id,
            playerId: targetCom.playerId,
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (roomService as any)['vacantSeats'][roomId] = {
          0: {
            roomPlayer: {
              id: '',
              playerId,
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
              id: '',
              playerId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3', 'C4'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
            replacementPlayerId: targetCom.playerId,
          },
        };

        const result = await roomService.joinRoom(roomId, user);

        expect(result).toBe(true);
        expect(room.players[0].playerId).toBe(playerId);
        expect(room.players[0].hand).toEqual(['H2', 'D3']);
        expect(gameState.getState().players[0].playerId).toBe(playerId);
        expect(gameState.getState().players[0].hand).toEqual(['H2', 'D3']);
        expect(gameState.getState().players[0].isPasser).toBe(true);
      });

      it('should remap com ids in current field and completed fields on rejoin', async () => {
        const roomId = 'room-123';
        const playerId = 'player-1';
        const user = {
          id: 'socket-new',
          playerId,
          name: 'Test Player',
        };

        const targetCom: RoomPlayer = {
          id: 'com-target',
          playerId: 'com-target',
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
        roomRepository.removePlayer.mockResolvedValue(true);
        roomRepository.addPlayer.mockResolvedValue(true);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            id: targetCom.id,
            playerId: targetCom.playerId,
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
            baseCard: '9♥',
            dealerId: targetCom.playerId,
            isComplete: false,
          },
          negriCard: null,
          neguri: { [targetCom.playerId]: '5♦' },
          fields: [
            {
              cards: ['7♣', '8♣', '9♣', '10♣'],
              winnerId: targetCom.playerId,
              winnerTeam: 0,
              dealerId: targetCom.playerId,
            },
          ],
          lastWinnerId: targetCom.playerId,
          openDeclared: false,
          openDeclarerId: targetCom.playerId,
        };
        gameState.getState().teamAssignments[targetCom.playerId] = 0;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (roomService as any)['vacantSeats'][roomId] = {
          0: {
            roomPlayer: {
              id: '',
              playerId,
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
              id: '',
              playerId,
              name: 'Test Player',
              team: 0,
              hand: ['H2', 'D3'],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
            replacementPlayerId: targetCom.playerId,
          },
        };

        const result = await roomService.joinRoom(roomId, user);

        expect(result).toBe(true);
        expect(gameState.getState().playState?.currentField?.dealerId).toBe(
          playerId,
        );
        expect(gameState.getState().playState?.fields[0]?.winnerId).toBe(
          playerId,
        );
        expect(gameState.getState().playState?.fields[0]?.dealerId).toBe(
          playerId,
        );
        expect(gameState.getState().playState?.lastWinnerId).toBe(playerId);
        expect(gameState.getState().playState?.openDeclarerId).toBe(playerId);
        expect(gameState.getState().playState?.neguri[playerId]).toBe('5♦');
        expect(
          gameState.getState().teamAssignments[targetCom.playerId],
        ).toBeUndefined();
        expect(gameState.getState().teamAssignments[playerId]).toBe(0);
      });

      it('should allow different player to take vacant seat and remove original token', async () => {
        const roomId = 'room-123';
        const originalPlayerId = 'player-1';
        const newUser = {
          id: 'socket-2',
          playerId: 'player-2', // Different playerId
          name: 'New Player',
        };

        const comPlayer: RoomPlayer = {
          id: 'com-0',
          playerId: 'com-0',
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
          players: [comPlayer],
        };

        roomRepository.findById.mockResolvedValue(room);
        roomRepository.removePlayer.mockResolvedValue(true);
        roomRepository.addPlayer.mockResolvedValue(true);

        // Setup game state and register original token
        const gameState = await roomService.getRoomGameState(roomId);
        gameState.registerPlayerToken(originalPlayerId, originalPlayerId);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (roomService as any)['vacantSeats'][roomId] = {
          0: {
            roomPlayer: {
              id: '',
              playerId: originalPlayerId,
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
              id: '',
              playerId: originalPlayerId,
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
        expect(room.players[0].playerId).toBe('player-2');
        expect(room.players[0].hand).toEqual(['H2', 'D3']);

        // Original player's token should be removed
        // Token is gone, so findPlayerByReconnectToken uses fallback (playerId direct search)
        // But original player is not in players array, so it should be null
        expect(
          gameState
            .getState()
            .players.find((p) => p.playerId === originalPlayerId),
        ).toBeUndefined();
      });
    });

    describe('restorePlayerFromVacantSeat', () => {
      it('should restore stored player snapshot into room and game state', async () => {
        const roomId = 'room-restore';
        const playerId = 'player-restore';

        const comPlayer: RoomPlayer = {
          id: 'com-0',
          playerId: 'com-0',
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
          players: [comPlayer],
        };

        roomRepository.findById.mockResolvedValue(room);
        roomRepository.removePlayer.mockResolvedValue(true);
        roomRepository.addPlayer.mockResolvedValue(true);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.getState().players = [
          {
            id: 'com-socket',
            playerId: 'com-0',
            name: 'COM',
            team: 0,
            hand: [],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
        ];

        const roomSnapshot: RoomPlayer = {
          id: '',
          playerId,
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
          id: '',
          playerId,
          name: 'Restore Player',
          team: 1,
          hand: ['H2', 'D3'],
          isPasser: true,
          hasBroken: true,
          hasRequiredBroken: false,
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (roomService as any)['vacantSeats'][roomId] = {
          0: {
            roomPlayer: roomSnapshot,
            gamePlayer: gameSnapshot,
          },
        };

        const restored = await roomService.restorePlayerFromVacantSeat(
          roomId,
          playerId,
        );

        expect(restored).toBe(true);
        expect(room.players[0].playerId).toBe(playerId);
        expect(room.players[0].hand).toEqual(['H2', 'D3']);
        expect(gameState.getState().players[0].playerId).toBe(playerId);
        expect(gameState.getState().players[0].isPasser).toBe(true);
        expect(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          (roomService as any)['vacantSeats'][roomId],
        ).toBeUndefined();
      });
    });

    describe('leaveRoom token preservation', () => {
      it('should not remove reconnectToken when leaving during play', async () => {
        const roomId = 'room-123';
        const playerId = 'player-1';

        const player: RoomPlayer = {
          id: 'socket-1',
          playerId: 'player-1',
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

        roomRepository.findById.mockResolvedValue(room);
        roomRepository.removePlayer.mockResolvedValue(true);
        roomRepository.addPlayer.mockResolvedValue(true);

        const gameState = await roomService.getRoomGameState(roomId);
        gameState.registerPlayerToken(playerId, playerId);
        gameState.getState().players.push({
          id: 'socket-1',
          playerId: 'player-1',
          name: 'Test Player',
          team: 0,
          hand: ['H2', 'D3'],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
        });

        await roomService.leaveRoom(roomId, playerId);

        // Token should still exist in the map (not removed)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const tokenMap = (gameState as any)['playerIds'];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        expect(tokenMap.has(playerId)).toBe(true);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        expect(tokenMap.get(playerId)).toBe(playerId);
      });
    });

    describe('5-Minute Timeout Logic', () => {
      it('should convert player to com after timeout callback', async () => {
        const roomId = 'test-room';
        const playerId = 'player-1';

        // Mock the room to be in playing status
        roomRepository.findById.mockResolvedValue({
          id: roomId,
          status: RoomStatus.PLAYING,
          players: [
            {
              id: 'id-1',
              playerId,
              name: 'Player 1',
              hand: [],
              team: 0,
              isReady: true,
              isHost: false,
              joinedAt: new Date(),
              isPasser: false,
              hasBreak: false,
              hasRequiredBreak: false,
              socketId: 'socket-1',
            } as RoomPlayer,
          ],
        } as Room);

        roomRepository.removePlayer.mockResolvedValue(true);
        roomRepository.addPlayer.mockResolvedValue(true);

        // Execute convertPlayerToCOM
        const result = await roomService.convertPlayerToCOM(roomId, playerId);

        expect(result).toBe(true);

        // Verify player was converted to com
        const room = await roomService.getRoom(roomId);
        const comPlayer = room?.players.find((p) =>
          p.playerId.startsWith('com-'),
        );
        expect(comPlayer).toBeDefined();

        // Verify vacantSeats contains the player's data
        /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
        expect((roomService as any)['vacantSeats'][roomId]).toBeDefined();
        const vacantSeat = Object.values(
          (roomService as any)['vacantSeats'][roomId],
        )[0] as any;
        expect(vacantSeat.roomPlayer.playerId).toBe(playerId);
        /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
      });
    });
  });
});
