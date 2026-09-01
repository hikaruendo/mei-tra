import type { SeatId } from './ids';

export type Team = 0 | 1;

export type TeamNames = Partial<Record<Team, string>>;

export type TransportGamePhase = 'deal' | 'blow' | 'play' | 'waiting' | null;

export type TrumpType = 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';

export interface ConnectionUserContract {
  socketId: string;
  seatId: SeatId;
  name: string;
  userId?: string;
  isAuthenticated?: boolean;
}

export interface PlayerContract extends ConnectionUserContract {
  team: Team;
  hand: string[];
  isHost?: boolean;
  isPasser?: boolean;
  isCOM?: boolean;
  hasBroken?: boolean;
  hasRequiredBroken?: boolean;
}

export interface BlowDeclarationContract {
  seatId: SeatId;
  team?: Team;
  trumpType: TrumpType;
  numberOfPairs: number;
  timestamp: number;
}

export interface BlowActionContract {
  type: 'declare' | 'pass';
  seatId: SeatId;
  trumpType?: TrumpType;
  numberOfPairs?: number;
  timestamp: number;
}

export interface BlowStateContract {
  currentTrump: TrumpType | null;
  currentHighestDeclaration: BlowDeclarationContract | null;
  declarations: BlowDeclarationContract[];
  actionHistory: BlowActionContract[];
  lastPasserSeatId: SeatId | null;
  isRoundCancelled: boolean;
  currentBlowIndex: number;
}

export interface FieldContract {
  cards: string[];
  playedBySeatIds: SeatId[];
  baseCard: string;
  baseSuit?: string;
  dealerSeatId: SeatId;
  declaredSuit?: string;
  isComplete: boolean;
}

export interface CompletedFieldContract {
  cards: string[];
  winnerSeatId: SeatId;
  winnerTeam: Team;
  dealerSeatId: SeatId;
}

export interface TransportTeamScore {
  play: number;
  total: number;
}

export interface TransportTeamScores {
  [key: number]: TransportTeamScore;
}

export interface GameStatePayload {
  players: PlayerContract[];
  gamePhase: TransportGamePhase;
  currentField: FieldContract | null;
  currentTurnSeatId: SeatId | null;
  blowState: BlowStateContract;
  teamScores: TransportTeamScores;
  youSeatId: SeatId | null;
  isSpectator?: boolean;
  negriCard: string | null;
  negriSeatId: SeatId | null;
  revealedAgari?: string | null;
  fields: CompletedFieldContract[];
  roomId: string;
  hostSeatId: SeatId;
  pointsToWin: number;
  teamNames?: TeamNames;
}

export interface BlowUpdatedPayload {
  declarations: BlowDeclarationContract[];
  actionHistory?: BlowActionContract[];
  currentHighest: BlowDeclarationContract | null;
  lastPasserSeatId: SeatId | null;
}

export interface SyncGameStatePayload {
  roomId?: string;
}

export type ReconnectionFailureCode =
  | 'roomUnavailable'
  | 'sessionInvalid'
  | 'stateInconsistent';

export interface BackToLobbyPayload {
  code: ReconnectionFailureCode;
}

export interface UpdatePhasePayload {
  phase: TransportGamePhase;
  scores: TransportTeamScores;
  winner: Team | null;
  currentHighestDeclaration?: BlowDeclarationContract | null;
  currentTrump?: TrumpType | null;
}

export interface RequestAgariPayload {
  roomId: string;
}

export interface RevealAgariPayload {
  agari: string;
  message: string;
  seatId: SeatId;
}

export interface BrokenPayload {
  nextSeatId: SeatId;
  players: PlayerContract[];
  gamePhase?: TransportGamePhase;
}

export interface FieldCompletePayload {
  winnerSeatId: SeatId;
  field: CompletedFieldContract;
  nextSeatId: SeatId;
}

export interface PlayCardPayload {
  roomId: string;
  card: string;
}

export interface CardPlayedPayload {
  seatId: SeatId;
  card: string;
  field: FieldContract;
  players: PlayerContract[];
  nextSeatId?: SeatId;
}

export type UpdateTurnPayload = SeatId;

export interface TurnAckPayload {
  roomId?: string;
}

export interface RoundResultsPayload {
  scores: TransportTeamScores;
}

export interface RoundCancelledPayload {
  nextDealerSeatId: SeatId;
  players: PlayerContract[];
  reason?: 'all-passed' | 'field-recovery';
  currentTrump?: TrumpType | null;
  currentHighestDeclaration?: BlowDeclarationContract | null;
  blowDeclarations?: BlowDeclarationContract[];
  actionHistory?: BlowActionContract[];
}

export interface NewRoundStartedPayload {
  players: PlayerContract[];
  currentTurnSeatId: SeatId;
  gamePhase: TransportGamePhase;
  currentField: FieldContract | null;
  completedFields: CompletedFieldContract[];
  negriCard: string | null;
  negriSeatId: SeatId | null;
  revealedAgari: string | null;
  currentTrump: TrumpType | null;
  currentHighestDeclaration: BlowDeclarationContract | null;
  blowDeclarations: BlowDeclarationContract[];
}

export interface GameOverPayload {
  winner: string;
  winningTeam?: Team;
  finalScores: TransportTeamScores;
}

export interface GameStartedPayload {
  roomId: string;
  players: PlayerContract[];
  pointsToWin: number;
  teamNames?: TeamNames;
  currentTurnSeatId?: SeatId;
}

/**
 * `update-turn` is held back by this much at game start so clients can play
 * the first-turn reveal animation. The animation may outlast it — clients do
 * not abort the reveal when the rebroadcast repeats its own seat — but it
 * must end before COM's earliest first action (this delay + pacing margin +
 * COM think time).
 */
export const GAME_START_TURN_REVEAL_DELAY_MS = 5000;

/**
 * The blow phase ends with a beat before the play phase opens: the winning
 * bid is left on screen, then the trump, the agari and the negri prompt
 * arrive together. Everything the transition produces — including the
 * winner's hand with the agari added — is held for this long, so the state
 * never runs ahead of the presentation that explains it.
 */
export const PLAY_PHASE_REVEAL_DELAY_MS = 3000;

export interface PlaySetupCompletePayload {
  negriCard: string;
  startingSeatId: SeatId;
}

export interface GameMessagePayload {
  message: string;
}

export interface PlayerLeftPayload {
  seatId: SeatId;
  roomId: string;
}

export interface PlayerDisconnectedPayload extends PlayerLeftPayload {
  playerName?: string;
}

export interface PlayerConvertedToComPayload {
  seatId: SeatId;
  playerName: string;
  message: string;
}

export interface TurnPingPayload {
  roomId: string;
  seatId: SeatId;
}

export interface PlayerIdlePayload {
  roomId: string;
  seatId: SeatId;
  playerName?: string;
  idleMs?: number;
}
