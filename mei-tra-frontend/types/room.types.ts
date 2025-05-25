import { Player, Team } from './game.types';

export interface Room {
  id: string;
  name: string;
  hostId: string;
  status: RoomStatus;
  players: RoomPlayer[];
  settings: RoomSettings;
  createdAt: Date;
  updatedAt: Date;
  teamAssignments: {
    [playerId: string]: Team;
  };
}

export interface RoomPlayer extends Player {
  isReady: boolean;
  isHost: boolean;
  joinedAt: Date;
}

export interface RoomSettings {
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
  teamAssignmentMethod: 'random' | 'host-choice';
  pointsToWin: number;
  allowSpectators: boolean;
}

export enum RoomStatus {
  WAITING = 'waiting',
  READY = 'ready',
  PLAYING = 'playing',
  FINISHED = 'finished',
  ABANDONED = 'abandoned'
} 