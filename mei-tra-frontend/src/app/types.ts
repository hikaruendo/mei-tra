import { Team, GamePhase, TrumpType, Field, CompletedField, BlowDeclaration } from '@/types/game.types';

export type { Team, GamePhase, TrumpType, Field, CompletedField, BlowDeclaration };

export interface Player {
  id: string;
  name: string;
  team: Team;
  hand: string[];
  isPasser?: boolean;
  hasBroken?: boolean;
}

export interface TeamScore {
  deal: number;
  blow: number;
  play: number;
  total: number;
}

export interface TeamPlayers {
  team0: Player[];
  team1: Player[];
}

export interface TeamScores {
  [key: number]: TeamScore;
}

export interface GameActions {
  selectNegri: (card: string) => void;
  playCard: (card: string) => void;
  declareBlow: () => void;
  passBlow: () => void;
} 