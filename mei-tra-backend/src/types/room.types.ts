export interface Room {
  id: string;
  name: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  players: string[];
  settings: RoomSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomSettings {
  maxPlayers: number;
  isPrivate: boolean;
  password: string | null;
}

export interface RoomRepository {
  createRoom(room: Room): Promise<Room>;
  getRoom(roomId: string): Promise<Room | null>;
  updateRoom(roomId: string, updates: Partial<Room>): Promise<Room | null>;
  deleteRoom(roomId: string): Promise<void>;
  listRooms(): Promise<Room[]>;
}
