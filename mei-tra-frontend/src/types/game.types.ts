export type Team = 0 | 1;

export type GamePhase = 'deal' | 'blow' | 'play' | 'complete' | null;

export type TrumpType = 'tra' | 'hel' | 'daya' | 'club' | 'zuppe';

export interface CompletedField {
  cards: string[];
  winnerId: string;
  winnerTeam: Team;
}

export interface Field {
  cards: string[];
  baseCard: string;
  dealerId: string;
  isComplete: boolean;
}

// Update socket event types
export interface FieldCompleteEvent {
  winnerId: string;
  field: CompletedField;
  nextPlayerId: string;
}

export interface Player {
  id: string;
  name: string;
  team: Team;
  hand: string[];
  isPasser?: boolean;
  hasBroken?: boolean;
}

export interface BlowDeclaration {
  playerId: string;
  trumpType: TrumpType;
  numberOfPairs: number;
  timestamp: number;
}

export interface TeamScores {
  [key: number]: {
    deal: number;
    blow: number;
    play: number;
    total: number;
  };
}

export interface TeamScore {
  deal: number;
  blow: number;
  play: number;
  total: number;
}

export interface TeamScoreRecord {
  deal: number;
  blow: number;
  play: number;
  total: number;
  round: number;
} 