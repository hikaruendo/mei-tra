export type Team = 0 | 1;

export type GamePhase = 'deal' | 'blow' | 'play' | 'complete' | null;

export type TrumpType = 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';

export interface User {
  id: string; // Socket ID
  playerId: string; // Legacy player identifier
  name: string;
  userId?: string; // Supabase auth user ID (optional for backward compatibility)
  isAuthenticated?: boolean; // Whether user is authenticated with Supabase
}

export interface CompletedField {
  cards: string[];
  winnerId: string;
  winnerTeam: Team;
}

export interface Field {
  cards: string[];
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

export interface Player extends User {
  team: Team;
  hand: string[];
  isPasser?: boolean;
  hasBroken?: boolean;
  hasRequiredBroken?: boolean;
}

export interface BlowDeclaration {
  playerId: string;
  trumpType: TrumpType;
  numberOfPairs: number;
  timestamp: number;
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