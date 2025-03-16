export interface Player {
  id: string;
  name: string;
  hand: string[];
  team: number;
  isPasser?: boolean;
  hasBroken?: boolean;
}

export interface TeamScore {
  deal: number;
  blow: number;
  play: number;
  total: number;
}

export type TrumpType = 'tra' | 'hel' | 'daya' | 'club' | 'zuppe';

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
  startingPlayerId: string | null;
}

export interface Field {
  cards: string[];
  baseCard: string;
  dealerId: string;
  declaredSuit?: string;
  isComplete: boolean;
}

export interface PlayState {
  currentField: Field | null;
  neguri: { [playerId: string]: string };
  fields: Field[];
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

export interface GameState {
  players: Player[];
  deck: string[];
  currentPlayerIndex: number;
  agari: string | null;
  teamScores: { [key: number]: TeamScore };
  gamePhase: 'deal' | 'blow' | 'play' | null;
  blowState: BlowState;
  playState: PlayState;
  teamScoreRecords: { [key: number]: TeamScoreRecord };
  chomboViolations: ChomboViolation[];
}
