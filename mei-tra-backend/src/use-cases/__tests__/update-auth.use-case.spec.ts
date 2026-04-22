import { UpdateAuthUseCase } from '../update-auth.use-case';
import { AuthService } from '../../auth/auth.service';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { IGameStateService } from '../../services/interfaces/game-state-service.interface';
import { AuthenticatedUser } from '../../types/user.types';
import { Room, RoomStatus } from '../../types/room.types';
import { GameStateService } from '../../services/game-state.service';
import { PlayerConnectionState, SessionUser } from '../../types/session.types';
import { TransportPlayer } from '../../types/player-adapters';

describe('UpdateAuthUseCase', () => {
  const createAuthServiceMock = () =>
    ({
      getUserFromSocketToken: jest.fn(),
    }) as unknown as jest.Mocked<AuthService>;

  const createRoomServiceMock = () =>
    ({
      getRoomGameState: jest.fn(),
      updatePlayerInRoom: jest.fn(),
      getRoom: jest.fn(),
    }) as unknown as jest.Mocked<IRoomService>;

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
        fontSize: 'standard',
      },
    },
  };

  it('updates connected user and room players when display name changes', async () => {
    const authService = createAuthServiceMock();
    const users: SessionUser[] = [
      {
        socketId: 'socket-1',
        playerId: 'player-1',
        name: 'Old Name',
        userId: 'user-1',
        isAuthenticated: true,
      },
    ];
    const gameState = {
      getSessionUsers: jest.fn(() => users),
      upsertSessionUser: jest.fn((sessionUser: SessionUser) => {
        users[0] = sessionUser;
        return {
          user: sessionUser,
          created: false,
          changed: true,
        };
      }),
    } as unknown as jest.Mocked<IGameStateService>;
    const roomService = createRoomServiceMock();
    const roomState = {
      players: [
        {
          socketId: 'socket-1',
          playerId: 'player-1',
          name: 'Old Name',
          userId: 'user-1',
          isAuthenticated: true,
          hand: [],
          team: 0,
          isPasser: false,
        } as TransportPlayer,
      ],
    };
    const roomGameState = {
      getState: jest.fn(() => roomState),
      findPlayerByActorId: jest.fn((actorId: string) =>
        actorId === 'user-1'
          ? (roomState.players.find(
              (player) => player.playerId === 'player-1',
            ) ?? null)
          : null,
      ),
      findPlayerBySocketId: jest.fn((socketId: string) =>
        socketId === 'socket-1'
          ? (roomState.players.find(
              (player) => player.playerId === 'player-1',
            ) ?? null)
          : null,
      ),
      applyPlayerConnectionState: jest
        .fn()
        .mockImplementation(
          async (_playerId: string, connectionState: PlayerConnectionState) => {
            roomState.players[0].socketId = connectionState.socketId;
            roomState.players[0].userId = connectionState.userId;
            roomState.players[0].isAuthenticated =
              connectionState.isAuthenticated;
          },
        ),
      saveState: jest.fn().mockResolvedValue(undefined),
    } as unknown as GameStateService;
    const updatedRoom: Room = {
      id: 'room-1',
      name: 'Room',
      hostId: 'player-1',
      status: RoomStatus.WAITING,
      players: [
        {
          socketId: 'socket-1',
          playerId: 'player-1',
          name: 'User Display',
          userId: 'user-1',
          isAuthenticated: true,
          hand: [],
          team: 0,
          isPasser: false,
          isReady: false,
          isHost: true,
          joinedAt: new Date(),
        },
      ],
      settings: {
        maxPlayers: 4,
        isPrivate: false,
        password: null,
        teamAssignmentMethod: 'random',
        pointsToWin: 30,
        allowSpectators: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    };

    authService.getUserFromSocketToken = jest
      .fn()
      .mockResolvedValue(authenticatedUser);
    roomService.getRoomGameState = jest.fn().mockResolvedValue(roomGameState);
    roomService.updatePlayerInRoom = jest.fn().mockResolvedValue(true);
    roomService.getRoom = jest.fn().mockResolvedValue(updatedRoom);

    const useCase = new UpdateAuthUseCase(authService, gameState, roomService);

    const result = await useCase.execute({
      socketId: 'socket-1',
      token: 'token',
      currentRoomId: 'room-1',
    });

    expect(result.success).toBe(true);
    expect(authService.getUserFromSocketToken).toHaveBeenCalledWith('token', {
      bypassCache: true,
    });
    expect(gameState.upsertSessionUser).toHaveBeenCalledWith(
      expect.objectContaining({
        socketId: 'socket-1',
        name: 'User Display',
        userId: 'user-1',
        isAuthenticated: true,
      }),
    );
    expect(roomService.updatePlayerInRoom).toHaveBeenCalledWith(
      'room-1',
      'player-1',
      expect.objectContaining({
        socketId: 'socket-1',
        name: 'User Display',
        userId: 'user-1',
        isAuthenticated: true,
      }),
    );
    expect(roomGameState.saveState).toHaveBeenCalled();
    expect(result.broadcastEvents).toContainEqual(
      expect.objectContaining({
        event: 'update-users',
      }),
    );
    expect(result.roomEvents).toContainEqual(
      expect.objectContaining({
        event: 'update-players',
        payload: [
          expect.objectContaining({
            socketId: 'socket-1',
            playerId: 'player-1',
            name: 'User Display',
            userId: 'user-1',
            isAuthenticated: true,
            isHost: true,
          }),
        ],
      }),
    );
    const roomUpdatedEvent = result.roomEvents?.find(
      (event) => event.event === 'room-updated',
    );
    expect(roomUpdatedEvent).toBeDefined();
    expect(roomUpdatedEvent?.payload).toMatchObject({
      id: updatedRoom.id,
      hostId: updatedRoom.hostId,
      name: updatedRoom.name,
      status: updatedRoom.status,
    });
    const roomSyncEvent = result.roomEvents?.find(
      (event) => event.event === 'room-sync',
    );
    expect(roomSyncEvent).toBeDefined();
    expect(roomSyncEvent?.payload).toMatchObject({
      room: {
        id: 'room-1',
        hostId: 'player-1',
      },
      players: [
        {
          socketId: 'socket-1',
          playerId: 'player-1',
          name: 'User Display',
        },
      ],
    });
  });
});
