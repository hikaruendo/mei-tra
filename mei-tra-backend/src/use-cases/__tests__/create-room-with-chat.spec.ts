/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { CreateRoomUseCase } from '../create-room.use-case';
import { ChatService } from '../../services/chat.service';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { Room, RoomPlayer, RoomStatus } from '../../types/room.types';

describe('CreateRoomUseCase', () => {
  let createRoomUseCase: CreateRoomUseCase;
  let roomService: jest.Mocked<IRoomService>;
  let chatService: jest.Mocked<ChatService>;

  const roomId = 'game-room-123';
  const userId = 'user-123';
  const hostPlayer: RoomPlayer = {
    socketId: '',
    playerId: userId,
    userId,
    isAuthenticated: true,
    name: 'Test Player',
    team: 0,
    hand: [],
    isPasser: false,
    hasBroken: false,
    hasRequiredBroken: false,
    isReady: false,
    isHost: true,
    joinedAt: new Date(),
  } as RoomPlayer;

  const createdRoom: Room = {
    id: roomId,
    name: 'Test Game Room',
    hostId: userId,
    status: RoomStatus.WAITING,
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

  const updatedRoom: Room = {
    ...createdRoom,
    players: [hostPlayer],
  };

  beforeEach(() => {
    roomService = {
      createRoom: jest.fn(),
      createNewRoom: jest.fn().mockResolvedValue(createdRoom),
      listRooms: jest.fn().mockResolvedValue([updatedRoom]),
      getRoom: jest.fn().mockResolvedValue(updatedRoom),
      joinRoom: jest.fn().mockResolvedValue(true),
      leaveRoom: jest.fn(),
      getRoomGameState: jest.fn(),
      updateRoomStatus: jest.fn(),
      updatePlayerInRoom: jest.fn(),
      updateRoom: jest.fn(),
      deleteRoom: jest.fn(),
      releaseRoomResources: jest.fn(),
      canStartGame: jest.fn(),
      handlePlayerReconnection: jest.fn(),
      restorePlayerFromVacantSeat: jest.fn(),
      convertPlayerToCOM: jest.fn(),
      updateUserGameStats: jest.fn(),
      updateUserLastSeen: jest.fn(),
      fillVacantSeatsWithCOM: jest.fn(),
      initCOMPlaceholders: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<IRoomService>;

    chatService = {
      createRoom: jest.fn().mockResolvedValue({}),
      postMessage: jest.fn(),
      listMessages: jest.fn(),
      getRoom: jest.fn(),
      listRooms: jest.fn(),
    } as unknown as jest.Mocked<ChatService>;

    createRoomUseCase = new CreateRoomUseCase(roomService, chatService);
  });

  it('creates the room, joins the host, initializes COM placeholders, and creates chat room', async () => {
    const result = await createRoomUseCase.execute({
      roomName: 'Test Game Room',
      pointsToWin: 10,
      teamAssignmentMethod: 'random',
      playerName: 'Test Player',
      authenticatedUser: { id: userId, profile: {} as any },
    });

    expect(result.success).toBe(true);
    expect(roomService.createNewRoom).toHaveBeenCalledWith(
      'Test Game Room',
      userId,
      10,
      'random',
    );
    expect(roomService.joinRoom).toHaveBeenCalledWith(
      roomId,
      expect.objectContaining({
        playerId: userId,
        userId,
        name: 'Test Player',
      }),
    );
    expect(roomService.initCOMPlaceholders).toHaveBeenCalledWith(roomId);
    expect(chatService.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        id: roomId,
        scope: 'table',
        name: 'Game: Test Game Room',
        ownerId: userId,
      }),
    );
    expect(result.data?.room).toEqual(updatedRoom);
    expect(result.data?.hostPlayer).toEqual(hostPlayer);
  });

  it('still succeeds when chat room creation fails', async () => {
    chatService.createRoom.mockRejectedValueOnce(new Error('chat failed'));

    const result = await createRoomUseCase.execute({
      roomName: 'Test Game Room',
      pointsToWin: 10,
      teamAssignmentMethod: 'random',
      playerName: 'Test Player',
      authenticatedUser: { id: userId, profile: {} as any },
    });

    expect(result.success).toBe(true);
    expect(result.data?.room.id).toBe(roomId);
  });
});
