// Temporary local types - copied from shared
export type Team = 0 | 1;

export interface User {
  id: string;
  playerId: string;
  name: string;
}

export interface Player extends User {
  hand: string[];
  team: Team;
  isPasser: boolean;
  hasBroken?: boolean;
  hasRequiredBroken?: boolean;
}

export interface TeamScore {
  play: number;
  total: number;
}

export interface TeamScores {
  [key: number]: TeamScore;
}

export type TrumpType = 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';

export interface BlowDeclaration {
  playerId: string;
  trumpType: TrumpType;
  numberOfPairs: number;
  timestamp: number;
}

export interface Field {
  cards: string[];
  baseCard: string;
  baseSuit?: string;
  dealerId: string;
  declaredSuit?: string;
  isComplete: boolean;
}

export interface CompletedField {
  cards: string[];
  winnerId: string;
  winnerTeam: number;
  dealerId: string;
}

export type GamePhase = 'deal' | 'blow' | 'play' | 'waiting' | null;

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
  lastActivityAt: Date;
}

export interface RoomSettings {
  maxPlayers: number;
  isPrivate: boolean;
  password: string | null;
  teamAssignmentMethod: 'random' | 'host-choice';
  pointsToWin: number;
  allowSpectators: boolean;
}