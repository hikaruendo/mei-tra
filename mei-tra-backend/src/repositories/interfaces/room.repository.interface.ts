import { Room, RoomStatus, RoomPlayer } from '../../types/room.types';

export interface IRoomRepository {
  // Basic CRUD operations
  create(room: Room): Promise<Room>;
  findById(roomId: string): Promise<Room | null>;
  update(roomId: string, updates: Partial<Room>): Promise<Room | null>;
  delete(roomId: string): Promise<void>;
  findAll(): Promise<Room[]>;

  // Room-specific operations
  findByStatus(status: RoomStatus): Promise<Room[]>;
  findByHostId(hostId: string): Promise<Room[]>;
  updateStatus(roomId: string, status: RoomStatus): Promise<boolean>;
  updateLastActivity(roomId: string): Promise<void>;

  // Player management
  addPlayer(roomId: string, player: RoomPlayer): Promise<boolean>;
  removePlayer(roomId: string, playerId: string): Promise<boolean>;
  updatePlayer(
    roomId: string,
    playerId: string,
    updates: Partial<RoomPlayer>,
  ): Promise<boolean>;

  // Cleanup operations
  deleteExpiredRooms(expiryTime: number): Promise<number>;
  findRoomsOlderThan(timestamp: Date): Promise<Room[]>;
}
