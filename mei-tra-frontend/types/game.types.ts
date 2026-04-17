import type { PlayerContract } from '@contracts/game';

export type Team = 0 | 1;

export type GamePhase = 'deal' | 'blow' | 'play' | 'complete' | null;

export type TrumpType = 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';

export interface ConnectionUser {
  socketId: string; // Connection/session identifier only
  playerId: string; // Table participant identifier (future participantId equivalent)
  name: string;
  userId?: string; // Canonical authenticated account ID
  isAuthenticated?: boolean;
}

export interface CompletedField {
  cards: string[];
  winnerId: string;
  winnerTeam: Team;
}

export interface Field {
  cards: string[];
  playedBy: string[];
  baseCard: string;
  baseSuit?: string;
  dealerId: string;
  isComplete: boolean;
}

// Update socket event types
export interface FieldCompleteEvent {
  winnerId: string;
  field: CompletedField;
  nextPlayerId: string;
}

export interface Player extends ConnectionUser {
  team: Team;
  hand: string[];
  isHost?: boolean;
  isPasser?: boolean;
  isCOM?: boolean;
  hasBroken?: boolean;
  hasRequiredBroken?: boolean;
}

export interface BlowDeclaration {
  playerId: string;
  trumpType: TrumpType;
  numberOfPairs: number;
  timestamp: number;
}

export interface BlowAction {
  type: 'declare' | 'pass';
  playerId: string;
  trumpType?: TrumpType;
  numberOfPairs?: number;
  timestamp: number;
}

export interface BlowState {
  currentTrump: TrumpType | null;
  currentHighestDeclaration: BlowDeclaration | null;
  declarations: BlowDeclaration[];
  actionHistory: BlowAction[];
  lastPasser: string | null;
  isRoundCancelled: boolean;
  currentBlowIndex: number;
}

export interface TeamScore {
  deal: number;
  blow: number;
  play: number;
  total: number;
}

export interface TeamScores {
  [key: number]: TeamScore;
}

export interface RoundScore {
  declared: number;
  actual: number;
  points: number;
}

export interface TeamScoreRecord {
  roundScores: RoundScore[];
}

export interface TeamPlayers {
  team0: Player[];
  team1: Player[];
}

export interface GameActions {
  selectNegri: (card: string) => void;
  playCard: (card: string) => void;
  declareBlow: () => void;
  passBlow: () => void;
  selectBaseSuit: (suit: string) => void;
  revealBrokenHand: (playerId: string) => void;
} 

export function fromPlayerContract(player: PlayerContract): Player {
  return {
    socketId: player.socketId,
    playerId: player.playerId,
    name: player.name,
    userId: player.userId,
    isAuthenticated: player.isAuthenticated,
    team: player.team,
    hand: [...player.hand],
    isHost: player.isHost,
    isPasser: player.isPasser,
    isCOM: player.isCOM,
    hasBroken: player.hasBroken ?? false,
    hasRequiredBroken: player.hasRequiredBroken ?? false,
  };
}

export function fromPlayerContracts(players: PlayerContract[]): Player[] {
  return players.map(fromPlayerContract);
}
