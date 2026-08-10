import { Room, RoomStatus, RoomPlayer } from '../../types/room.types';

export interface IRoomRepository {
  // Basic CRUD operations
  createWithHostSeat(
    room: Room,
    hostPlayer: RoomPlayer,
    transitionId: string,
  ): Promise<Room>;
  findById(roomId: string): Promise<Room | null>;
  update(roomId: string, updates: Partial<Room>): Promise<Room | null>;
  delete(roomId: string): Promise<void>;
  findAll(): Promise<Room[]>;

  // Room-specific operations
  findByStatus(status: RoomStatus): Promise<Room[]>;
  findByHostId(hostId: string): Promise<Room[]>;
  findRecentFinishedByUserId(userId: string, limit: number): Promise<Room[]>;
  updateStatus(roomId: string, status: RoomStatus): Promise<boolean>;
  updateLastActivity(roomId: string): Promise<void>;

  // Cleanup operations
  deleteExpiredRooms(expiryTime: number): Promise<number>;
  findRoomsOlderThan(timestamp: Date): Promise<Room[]>;
}
