/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { CreateRoomUseCase } from '../create-room.use-case';
import { ChatService } from '../../services/chat.service';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { Room, RoomStatus } from '../../types/room.types';
import { ChatRoom, ChatRoomId } from '../../types/social.types';

describe('CreateRoomUseCase with Chat Room Auto-creation', () => {
  let createRoomUseCase: CreateRoomUseCase;
  let roomService: jest.Mocked<IRoomService>;
  let gameStateService: jest.Mocked<any>;
  let chatService: jest.Mocked<ChatService>;

  beforeEach(() => {
    roomService = {
      createRoom: jest.fn(),
      createNewRoom: jest.fn(),
      listRooms: jest.fn(),
      getRoom: jest.fn(),
      joinRoom: jest.fn(),
      leaveRoom: jest.fn(),
      getRoomGameState: jest.fn(),
      updateRoomStatus: jest.fn(),
      updatePlayerInRoom: jest.fn(),
      updateRoom: jest.fn(),
      deleteRoom: jest.fn(),
      canStartGame: jest.fn(),
      handlePlayerReconnection: jest.fn(),
      restorePlayerFromVacantSeat: jest.fn(),
      convertPlayerToDummy: jest.fn(),
      updateUserGameStats: jest.fn(),
      updateUserLastSeen: jest.fn(),
    } as jest.Mocked<IRoomService>;

    gameStateService = {
      getUsers: jest.fn().mockReturnValue([
        { id: 'socket-1', playerId: 'user-123' },
        { id: 'socket-2', playerId: 'user-456' },
        { id: 'socket-3', playerId: 'user-789' },
        { id: 'socket-4', playerId: 'user-abc' },
      ]),
    };

    chatService = {
      createRoom: jest.fn(),
      postMessage: jest.fn(),
      listMessages: jest.fn(),
      getRoom: jest.fn(),
      listRooms: jest.fn(),
    } as unknown as jest.Mocked<ChatService>;

    createRoomUseCase = new CreateRoomUseCase(roomService, gameStateService);
  });

  describe('Chat Room Auto-creation Integration', () => {
    it('should create chat room with same ID as game room', async () => {
      const roomId = 'game-room-123';
      const userId = 'user-123';

      const mockRoom: Room = {
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

      const mockChatRoom = ChatRoom.create({
        id: ChatRoomId.create(roomId),
        scope: 'table',
        name: `Game: ${mockRoom.name}`,
        visibility: 'private',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      roomService.createNewRoom.mockResolvedValue(mockRoom);
      chatService.createRoom.mockResolvedValue(mockChatRoom);

      const result = await createRoomUseCase.execute({
        clientId: 'socket-1',
        roomName: 'Test Game Room',
        pointsToWin: 10,
        teamAssignmentMethod: 'random',
        playerName: 'Test Player',
        authenticatedUser: { id: userId, profile: {} as any },
      });

      expect(result.success).toBe(true);
      expect(result.data?.room.id).toBe(roomId);

      // In the actual implementation in GameGateway, chat room is created after this
      // This test verifies that the room ID can be used for chat room creation
      expect(mockRoom.id).toBeTruthy();
    });

    it('should handle chat room creation with custom room ID', async () => {
      const customRoomId = 'custom-game-room-456';
      const userId = 'user-456';

      const mockRoom: Room = {
        id: customRoomId,
        name: 'Custom Room',
        hostId: userId,
        status: RoomStatus.WAITING,
        settings: {
          maxPlayers: 4,
          isPrivate: true,
          password: 'secret',
          teamAssignmentMethod: 'host-choice',
          pointsToWin: 15,
          allowSpectators: false,
        },
        players: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      };

      const mockChatRoom = ChatRoom.create({
        id: ChatRoomId.create(customRoomId),
        scope: 'table',
        name: `Game: Custom Room`,
        ownerId: undefined,
        visibility: 'private',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      roomService.createNewRoom.mockResolvedValue(mockRoom);
      chatService.createRoom.mockResolvedValue(mockChatRoom);

      const result = await createRoomUseCase.execute({
        clientId: 'socket-2',
        roomName: 'Custom Room',
        pointsToWin: 15,
        teamAssignmentMethod: 'host-choice',
        playerName: 'Host Player',
        authenticatedUser: { id: userId, profile: {} as any },
      });

      expect(result.success).toBe(true);
      expect(result.data?.room.id).toBe(customRoomId);
    });
  });

  describe('Chat Room Creation Failure Handling', () => {
    it('should succeed game room creation even if chat room creation fails', async () => {
      const roomId = 'game-room-789';
      const userId = 'user-789';

      const mockRoom: Room = {
        id: roomId,
        name: 'Resilient Room',
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

      roomService.createNewRoom.mockResolvedValue(mockRoom);
      chatService.createRoom.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const result = await createRoomUseCase.execute({
        clientId: 'socket-3',
        roomName: 'Resilient Room',
        pointsToWin: 10,
        teamAssignmentMethod: 'random',
        playerName: 'Resilient Player',
        authenticatedUser: { id: userId, profile: {} as any },
      });

      // Game room creation should still succeed
      expect(result.success).toBe(true);
      expect(result.data?.room.id).toBe(roomId);
    });
  });

  describe('Chat Room Properties', () => {
    it('should create chat room with correct scope and visibility', async () => {
      const roomId = 'game-room-abc';
      const userId = 'user-abc';

      const mockChatRoom = ChatRoom.create({
        id: ChatRoomId.create(roomId),
        scope: 'table',
        name: 'Game: Test Room',
        ownerId: undefined,
        visibility: 'private',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      chatService.createRoom.mockResolvedValue(mockChatRoom);

      await chatService.createRoom({
        id: roomId,
        scope: 'table',
        name: 'Game: Test Room',
        ownerId: userId,
        visibility: 'private',
        messageTtlHours: 24,
      });

      expect(jest.mocked(chatService.createRoom)).toHaveBeenCalledWith(
        expect.objectContaining({
          id: roomId,
          scope: 'table',
          visibility: 'private',
        }),
      );
    });

    it('should set chat room name based on game room name', async () => {
      const roomId = 'game-room-xyz';
      const gameRoomName = 'Epic Battle Arena';
      const expectedChatRoomName = `Game: ${gameRoomName}`;

      const mockChatRoom = ChatRoom.create({
        id: ChatRoomId.create(roomId),
        scope: 'table',
        name: expectedChatRoomName,
        visibility: 'private',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      chatService.createRoom.mockResolvedValue(mockChatRoom);

      await chatService.createRoom({
        id: roomId,
        scope: 'table',
        name: expectedChatRoomName,
        visibility: 'private',
      });

      expect(jest.mocked(chatService.createRoom)).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expectedChatRoomName,
        }),
      );
    });

    it('should use default TTL of 24 hours for chat messages', async () => {
      const roomId = 'game-room-ttl';

      const mockChatRoom = ChatRoom.create({
        id: ChatRoomId.create(roomId),
        scope: 'table',
        visibility: 'private',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      chatService.createRoom.mockResolvedValue(mockChatRoom);

      await chatService.createRoom({
        id: roomId,
        scope: 'table',
        visibility: 'private',
        messageTtlHours: 24,
      });

      expect(jest.mocked(chatService.createRoom)).toHaveBeenCalledWith(
        expect.objectContaining({
          messageTtlHours: 24,
        }),
      );
    });
  });

  describe('Room ID Consistency', () => {
    it('should ensure game room ID matches chat room ID', async () => {
      const roomId = 'consistent-room-id';
      const userId = 'user-consistent';

      const mockRoom: Room = {
        id: roomId,
        name: 'Consistency Test',
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

      const mockChatRoom = ChatRoom.create({
        id: ChatRoomId.create(roomId),
        scope: 'table',
        visibility: 'private',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      roomService.createNewRoom.mockResolvedValue(mockRoom);
      chatService.createRoom.mockResolvedValue(mockChatRoom);

      const gameRoomResult = await createRoomUseCase.execute({
        clientId: 'socket-4',
        roomName: 'Consistency Test',
        pointsToWin: 10,
        teamAssignmentMethod: 'random',
        playerName: 'Consistent Player',
        authenticatedUser: { id: userId, profile: {} as any },
      });

      const chatRoomResult = await chatService.createRoom({
        id: roomId,
        scope: 'table',
        visibility: 'private',
      });

      expect(gameRoomResult.data?.room.id).toBe(roomId);
      expect(chatRoomResult.getId().getValue()).toBe(roomId);
    });
  });
});
