export type Team = 0 | 1;

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
  hand: string[];
  team: Team;
  isPasser?: boolean;
  hasBroken?: boolean;
} 