import { UpdateAuthUseCase } from '../update-auth.use-case';
import { AuthService } from '../../auth/auth.service';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { IGameStateService } from '../../services/interfaces/game-state-service.interface';
import { AuthenticatedUser } from '../../types/user.types';
import { ConnectionUser, Player } from '../../types/game.types';
import { Room, RoomStatus } from '../../types/room.types';
import { GameStateService } from '../../services/game-state.service';

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
      },
    },
  };

  it('updates connected user and room players when display name changes', async () => {
    const authService = createAuthServiceMock();
    const users: ConnectionUser[] = [
      {
        socketId: 'socket-1',
        playerId: 'player-1',
        name: 'Old Name',
        userId: 'user-1',
        isAuthenticated: true,
      },
    ];
    const gameState = {
      getUsers: jest.fn(() => users),
      findConnectionUserByUserId: jest.fn(
        (userId: string) =>
          users.find((user) => user.userId === userId) ?? null,
      ),
      findConnectionUserBySocketId: jest.fn(
        (socketId: string) =>
          users.find((user) => user.socketId === socketId) ?? null,
      ),
      updateUserNameBySocketId: jest.fn(() => {
        users[0].name = 'User Display';
        return true;
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
        } as Player,
      ],
    };
    const roomGameState = {
      getState: jest.fn(() => roomState),
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
    expect(gameState.updateUserNameBySocketId).toHaveBeenCalledWith(
      'socket-1',
      'User Display',
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
        payload: roomState.players,
      }),
    );
    expect(result.roomEvents).toContainEqual(
      expect.objectContaining({
        event: 'room-updated',
        payload: updatedRoom,
      }),
    );
  });
});
