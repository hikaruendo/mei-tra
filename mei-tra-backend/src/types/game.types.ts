export type Team = 0 | 1;

export interface Player {
  id: string;
  playerId: string;
  name: string;
  hand: string[];
  team: Team;
  isPasser: boolean;
  hasBroken?: boolean;
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

export interface BlowState {
  currentTrump: TrumpType | null;
  currentHighestDeclaration: BlowDeclaration | null;
  declarations: BlowDeclaration[];
  lastPasser: string | null;
  isRoundCancelled: boolean;
  currentBlowIndex: number;
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

export interface PlayState {
  currentField: Field | null;
  negriCard: string | null;
  neguri: Record<string, string>;
  fields: CompletedField[];
  lastWinnerId: string | null;
  isTanzenRound: boolean;
  openDeclared: boolean;
  openDeclarerId: string | null;
}

export interface ScoreCard {
  value: number;
  suit: '♥' | '♦' | '♠' | '♣';
  isFaceUp: boolean;
}

export interface TeamScoreRecord {
  cards: ScoreCard[];
  rememberedTen: number;
}

export interface ChomboViolation {
  type:
    | 'negri-forget'
    | 'wrong-suit'
    | 'four-jack'
    | 'last-tanzen'
    | 'wrong-broken'
    | 'wrong-open';
  playerId: string;
  timestamp: number;
  reportedBy: string | null;
  isExpired: boolean;
}

export type GamePhase = 'deal' | 'blow' | 'play' | 'waiting' | null;

export interface GameState {
  players: Player[];
  deck: string[];
  currentPlayerIndex: number;
  agari: string | null;
  teamScores: { [key: number]: TeamScore };
  gamePhase: GamePhase;
  currentTrump: TrumpType | null;
  blowState: BlowState;
  playState: PlayState;
  teamScoreRecords: { [key: number]: TeamScoreRecord };
  chomboViolations: ChomboViolation[];
  roundNumber: number;
}
