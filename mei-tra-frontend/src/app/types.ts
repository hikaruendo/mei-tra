export interface Player {
  id: string;
  name: string;
  hand: string[];
  team?: number;
  isPasser?: boolean;
  hasBroken?: boolean;
}

export interface TeamScore {
  deal: number;
  blow: number;
  play: number;
  total: number;
}

export interface BlowDeclaration {
  playerId: string;
  trumpType: TrumpType;
  numberOfPairs: number;
  timestamp: number;
}

export type TrumpType = 'tra' | 'hel' | 'daya' | 'club' | 'zuppe';
export type GamePhase = 'deal' | 'blow' | 'play' | null;

export interface TeamPlayers {
  team0: Player[];
  team1: Player[];
}

export interface TeamScores {
  [key: number]: TeamScore;
} 