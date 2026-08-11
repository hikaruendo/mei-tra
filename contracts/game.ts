import type { SeatId } from './ids';

export type Team = 0 | 1;

export type TeamNames = Partial<Record<Team, string>>;

export type TransportGamePhase = 'deal' | 'blow' | 'play' | 'waiting' | null;

export type TrumpType = 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';

export interface ConnectionUserContract {
  socketId: string;
  seatId?: SeatId;
  /** @deprecated Use seatId. This alias has the same value during migration. */
  playerId: string;
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
  seatId?: SeatId;
  /** @deprecated Use seatId. */
  playerId: string;
  team?: Team;
  trumpType: TrumpType;
  numberOfPairs: number;
  timestamp: number;
}

export interface BlowActionContract {
  type: 'declare' | 'pass';
  seatId?: SeatId;
  /** @deprecated Use seatId. */
  playerId: string;
  trumpType?: TrumpType;
  numberOfPairs?: number;
  timestamp: number;
}

export interface BlowStateContract {
  currentTrump: TrumpType | null;
  currentHighestDeclaration: BlowDeclarationContract | null;
  declarations: BlowDeclarationContract[];
  actionHistory: BlowActionContract[];
  lastPasserSeatId?: SeatId | null;
  /** @deprecated Use lastPasserSeatId. */
  lastPasser: string | null;
  isRoundCancelled: boolean;
  currentBlowIndex: number;
}

export interface FieldContract {
  cards: string[];
  playedBy: string[];
  playedBySeatIds?: SeatId[];
  baseCard: string;
  baseSuit?: string;
  dealerSeatId?: SeatId;
  /** @deprecated Use dealerSeatId. */
  dealerId: string;
  declaredSuit?: string;
  isComplete: boolean;
}

export interface CompletedFieldContract {
  cards: string[];
  winnerSeatId?: SeatId;
  /** @deprecated Use winnerSeatId. */
  winnerId: string;
  winnerTeam: Team;
  dealerSeatId?: SeatId;
  /** @deprecated Use dealerSeatId. */
  dealerId: string;
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
  currentTurnSeatId?: SeatId | null;
  /** @deprecated Use currentTurnSeatId. */
  currentTurn: string | null;
  blowState: BlowStateContract;
  teamScores: TransportTeamScores;
  youSeatId?: SeatId | null;
  /** @deprecated Use youSeatId. */
  you: string | null;
  isSpectator?: boolean;
  negriCard: string | null;
  negriSeatId?: SeatId | null;
  /** @deprecated Use negriSeatId. */
  negriPlayerId?: string | null;
  revealedAgari?: string | null;
  fields: CompletedFieldContract[];
  roomId: string;
  hostSeatId?: SeatId;
  /** @deprecated Use hostSeatId. */
  hostId?: string;
  pointsToWin: number;
  teamNames?: TeamNames;
}

export interface BlowUpdatedPayload {
  declarations: BlowDeclarationContract[];
  actionHistory?: BlowActionContract[];
  currentHighest: BlowDeclarationContract | null;
  lastPasserSeatId?: SeatId | null;
  /** @deprecated Use lastPasserSeatId. */
  lastPasser?: string | null;
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
  seatId?: SeatId;
  /** @deprecated Use seatId. */
  playerId: string;
}

export interface BrokenPayload {
  nextSeatId?: SeatId;
  /** @deprecated Use nextSeatId. */
  nextPlayerId: string;
  players: PlayerContract[];
  gamePhase?: TransportGamePhase;
}

export interface BlowStartedPayload {
  startingSeatId?: SeatId;
  /** @deprecated Use startingSeatId. */
  startingPlayer: string;
  players: PlayerContract[];
}

export interface FieldCompletePayload {
  winnerSeatId?: SeatId;
  /** @deprecated Use winnerSeatId. */
  winnerId: string;
  field: CompletedFieldContract;
  nextSeatId?: SeatId;
  /** @deprecated Use nextSeatId. */
  nextPlayerId: string;
}

export interface PlayCardPayload {
  roomId: string;
  card: string;
}

export interface CardPlayedPayload {
  seatId?: SeatId;
  /** @deprecated Use seatId. */
  playerId: string;
  card: string;
  field: FieldContract;
  players: PlayerContract[];
  nextSeatId?: SeatId;
  /** @deprecated Use nextSeatId. */
  nextPlayerId?: string;
}

export type UpdateTurnPayload = string;

export interface TurnAckPayload {
  roomId?: string;
}

export interface RoundResultsPayload {
  scores: TransportTeamScores;
}

export interface RoundCancelledPayload {
  nextDealerSeatId?: SeatId;
  /** @deprecated Use nextDealerSeatId. */
  nextDealer: string;
  players: PlayerContract[];
  currentTrump?: TrumpType | null;
  currentHighestDeclaration?: BlowDeclarationContract | null;
  blowDeclarations?: BlowDeclarationContract[];
  actionHistory?: BlowActionContract[];
}

export interface NewRoundStartedPayload {
  players: PlayerContract[];
  currentTurnSeatId?: SeatId;
  /** @deprecated Use currentTurnSeatId. */
  currentTurn: string;
  gamePhase: TransportGamePhase;
  currentField: FieldContract | null;
  completedFields: CompletedFieldContract[];
  negriCard: string | null;
  negriSeatId?: SeatId | null;
  /** @deprecated Use negriSeatId. */
  negriPlayerId: string | null;
  revealedAgari: string | null;
  currentTrump: TrumpType | null;
  currentHighestDeclaration: BlowDeclarationContract | null;
  blowDeclarations: BlowDeclarationContract[];
}

export interface GameOverPayload {
  winner: string;
  finalScores: TransportTeamScores;
}

export interface RoomPlayingPayload {
  players: PlayerContract[];
}

export interface GameStartedPayload {
  roomId: string;
  players: PlayerContract[];
  pointsToWin: number;
  teamNames?: TeamNames;
}

export interface PlaySetupCompletePayload {
  negriCard: string;
  startingSeatId?: SeatId;
  /** @deprecated Use startingSeatId. */
  startingPlayer: string;
}

export interface GameMessagePayload {
  message: string;
}

export interface PlayerLeftPayload {
  seatId?: SeatId;
  /** @deprecated Use seatId. */
  playerId: string;
  roomId: string;
}

export interface PlayerConvertedToComPayload {
  seatId?: SeatId;
  /** @deprecated Use seatId. */
  playerId: string;
  playerName: string;
  message: string;
}

export interface TurnPingPayload {
  roomId: string;
}

export interface PlayerIdlePayload {
  roomId: string;
  seatId?: SeatId;
  /** @deprecated Use seatId. */
  playerId: string;
  idleMs?: number;
}
