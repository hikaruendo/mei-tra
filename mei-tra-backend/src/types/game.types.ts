import type { SeatId } from './identity.types';

export type Team = 0 | 1;

export type TeamNames = Partial<Record<Team, string>>;

export interface PlayerIdentity {
  seatId: SeatId;
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
  seatId: SeatId;
  team?: Team;
  trumpType: TrumpType;
  numberOfPairs: number;
  timestamp: number;
}

export interface BlowAction {
  type: 'declare' | 'pass';
  seatId: SeatId;
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
  /**
   * How many times this round has been dealt again (全員パス / ブロークン /
   * 4ジャック). Reset with the round.
   *
   * Server-side only, deliberately absent from BlowStateContract: no client
   * renders it. It exists because a re-deal otherwise leaves the blow phase
   * looking identical to how it started — same round, same seat, empty action
   * history — and GameplayNotificationService needs to tell those two moments
   * apart. Optional so states persisted before it default to 0.
   */
  redealCount?: number;
}

export interface Field {
  cards: string[];
  playedBySeatIds: SeatId[];
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
  seatId: SeatId;
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
  violatorSeatId: SeatId;
  timestamp: number;
  reportedBySeatId: SeatId | null;
  isExpired: boolean;
}

export type GamePhase = 'deal' | 'blow' | 'play' | 'waiting' | null;

export interface GameState {
  version?: number;
  identitySchemaVersion?: 2;
  players: DomainPlayer[];
  currentSeatId?: SeatId | null;
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
}
