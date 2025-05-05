import { Player } from './game.types';

export enum RoomStatus {
  WAITING = 'waiting',
  READY = 'ready',
  PLAYING = 'playing',
  FINISHED = 'finished',
  ABANDONED = 'abandoned',
}

export interface RoomPlayer extends Player {
  isReady: boolean;
  isHost: boolean;
  joinedAt: Date;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  status: RoomStatus;
  players: RoomPlayer[];
  settings: RoomSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomSettings {
  maxPlayers: number;
  isPrivate: boolean;
  password: string | null;
  teamAssignmentMethod: 'random' | 'host-choice';
  pointsToWin: number;
  allowSpectators: boolean;
}

export interface RoomRepository {
  createRoom(room: Room): Promise<Room>;
  getRoom(roomId: string): Promise<Room | null>;
  updateRoom(roomId: string, updates: Partial<Room>): Promise<Room | null>;
  deleteRoom(roomId: string): Promise<void>;
  listRooms(): Promise<Room[]>;
}
