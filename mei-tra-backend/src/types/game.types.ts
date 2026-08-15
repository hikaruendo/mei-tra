import type { SeatId } from './identity.types';

export type Team = 0 | 1;

export type TeamNames = Partial<Record<Team, string>>;

export interface PlayerIdentity {
  seatId?: SeatId;
  /** @deprecated Use seatId. This alias is kept equal to seatId. */
  playerId: string;
  name: string;
}

export interface PlayerConnectionMetadata {
  socketId: string; // Connection/session identifier only
  userId?: string; // Canonical authenticated account ID
  isAuthenticated?: boolean;
}

export interface PlayerGameplayState {
  hand: string[];
  team: Team;
  isPasser: boolean;
  isCOM?: boolean;
  hasBroken?: boolean;
  hasRequiredBroken?: boolean;
}

export interface DomainPlayer extends PlayerIdentity, PlayerGameplayState {}

export interface TeamScore {
  play: number;
  total: number;
}

export interface TeamScores {
  [key: number]: TeamScore;
}

export type TrumpType = 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';

export interface BlowDeclaration {
  seatId?: SeatId;
  /** @deprecated Use seatId. */
  playerId: string;
  team?: Team;
  trumpType: TrumpType;
  numberOfPairs: number;
  timestamp: number;
}

export interface BlowAction {
  type: 'declare' | 'pass';
  seatId?: SeatId;
  /** @deprecated Use seatId. */
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
  lastPasserSeatId?: SeatId | null;
  isRoundCancelled: boolean;
  currentBlowIndex: number;
}

export interface Field {
  cards: string[];
  playedBy: string[];
  playedBySeatIds?: SeatId[];
  baseCard: string;
  baseSuit?: string;
  dealerSeatId: SeatId;
  declaredSuit?: string;
  isComplete: boolean;
}

export interface CompletedField {
  cards: string[];
  winnerSeatId: SeatId;
  winnerTeam: Team;
  dealerSeatId: SeatId;
}

export interface PlayState {
  currentField: Field | null;
  negriCard: string | null;
  negriSeatId?: SeatId | null;
  neguri: Record<string, string>;
  fields: CompletedField[];
  lastWinnerSeatId?: SeatId | null;
  openDeclared: boolean;
  openDeclarerSeatId?: SeatId | null;
}

export interface PendingBrokenHandReveal {
  seatId?: SeatId;
  /** @deprecated Use seatId. */
  playerId: string;
  handSnapshot: string[];
  startedAt: number;
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

export interface ScoreRecord {
  points: number;
  timestamp: Date;
  reason: string;
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
  version?: number;
  identitySchemaVersion?: 1 | 2;
  players: DomainPlayer[];
  currentSeatId?: SeatId | null;
  /** @deprecated Use currentSeatId. */
  currentPlayerId?: string | null;
  /** @deprecated Derive the index from currentSeatId and players. */
  currentPlayerIndex?: number;
  gamePhase: GamePhase;
  deck: string[];
  teamScores: Record<Team, { play: number; total: number }>;
  teamScoreRecords: Record<Team, ScoreRecord[]>;
  blowState: BlowState;
  playState?: PlayState;
  pendingBrokenHandReveal?: PendingBrokenHandReveal | null;
  agari?: string;
  roundNumber: number;
  pointsToWin: number;
  teamAssignments: {
    [playerId: string]: Team;
  };
}
