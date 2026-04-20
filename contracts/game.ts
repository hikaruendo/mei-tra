export type Team = 0 | 1;

export type TransportGamePhase = 'deal' | 'blow' | 'play' | 'waiting' | null;

export type TrumpType = 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';

export interface ConnectionUserContract {
  socketId: string;
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
  playerId: string;
  trumpType: TrumpType;
  numberOfPairs: number;
  timestamp: number;
}

export interface BlowActionContract {
  type: 'declare' | 'pass';
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
  lastPasser: string | null;
  isRoundCancelled: boolean;
  currentBlowIndex: number;
}

export interface FieldContract {
  cards: string[];
  playedBy: string[];
  baseCard: string;
  baseSuit?: string;
  dealerId: string;
  declaredSuit?: string;
  isComplete: boolean;
}

export interface CompletedFieldContract {
  cards: string[];
  winnerId: string;
  winnerTeam: Team;
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
  currentTurn: string | null;
  blowState: BlowStateContract;
  teamScores: TransportTeamScores;
  you: string;
  negriCard: string | null;
  fields: CompletedFieldContract[];
  roomId: string;
  hostId?: string;
  pointsToWin: number;
}

export interface UpdatePhasePayload {
  phase: TransportGamePhase;
  scores: TransportTeamScores;
  winner: Team | null;
  currentHighestDeclaration?: BlowDeclarationContract | null;
  currentTrump?: TrumpType | null;
}

export interface BrokenPayload {
  nextPlayerId: string;
  players: PlayerContract[];
  gamePhase?: TransportGamePhase;
}

export interface BlowStartedPayload {
  startingPlayer: string;
  players: PlayerContract[];
}

export interface FieldCompletePayload {
  winnerId: string;
  field: CompletedFieldContract;
  nextPlayerId: string;
}

export interface PlayCardPayload {
  roomId: string;
  card: string;
}

export interface CardPlayedPayload {
  playerId: string;
  card: string;
  field: FieldContract;
  players: PlayerContract[];
}

export type UpdateTurnPayload = string;

export interface RoundResultsPayload {
  scores: TransportTeamScores;
}

export interface RoundCancelledPayload {
  nextDealer: string;
  players: PlayerContract[];
  currentTrump?: TrumpType | null;
  currentHighestDeclaration?: BlowDeclarationContract | null;
  blowDeclarations?: BlowDeclarationContract[];
  actionHistory?: BlowActionContract[];
}

export interface NewRoundStartedPayload {
  players: PlayerContract[];
  currentTurn: string;
  gamePhase: TransportGamePhase;
  currentField: FieldContract | null;
  completedFields: CompletedFieldContract[];
  negriCard: string | null;
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
}
