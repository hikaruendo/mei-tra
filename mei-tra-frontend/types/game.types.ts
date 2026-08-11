import type { PlayerContract } from '@contracts/game';
import type { SeatId } from '@contracts/ids';
import { normalizePlayerIdentity } from '@meitra/game-client/identity';

export type Team = 0 | 1;

export type TeamNames = Partial<Record<Team, string>>;

export type GamePhase = 'deal' | 'blow' | 'play' | 'complete' | null;

export type TrumpType = 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';

export interface ConnectionUser {
  socketId: string; // Connection/session identifier only
  seatId: SeatId;
  /** @deprecated Use seatId. */
  playerId: string;
  name: string;
  userId?: string; // Canonical authenticated account ID
  isAuthenticated?: boolean;
  profileRevision?: number;
}

export interface CompletedField {
  cards: string[];
  winnerSeatId: SeatId;
  winnerId: string;
  winnerTeam: Team;
  dealerSeatId: SeatId;
  dealerId: string;
}

export interface Field {
  cards: string[];
  playedBy: string[];
  playedBySeatIds: SeatId[];
  baseCard: string;
  baseSuit?: string;
  dealerSeatId: SeatId;
  dealerId: string;
  isComplete: boolean;
}

// Update socket event types
export interface FieldCompleteEvent {
  winnerSeatId: SeatId;
  winnerId: string;
  field: CompletedField;
  nextSeatId: SeatId;
  nextPlayerId: string;
}

export interface Player extends ConnectionUser {
  team: Team;
  hand: string[];
  isHost?: boolean;
  isPasser?: boolean;
  isCOM?: boolean;
  hasBroken?: boolean;
  hasRequiredBroken?: boolean;
}

export interface BlowDeclaration {
  seatId: SeatId;
  playerId: string;
  team?: Team;
  trumpType: TrumpType;
  numberOfPairs: number;
  timestamp: number;
}

export interface BlowAction {
  type: 'declare' | 'pass';
  seatId: SeatId;
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
  lastPasser: string | null;
  isRoundCancelled: boolean;
  currentBlowIndex: number;
}

export interface TeamScore {
  deal: number;
  blow: number;
  play: number;
  total: number;
}

export interface TeamScores {
  [key: number]: TeamScore;
}

export interface RoundScore {
  declared: number;
  actual: number;
  points: number;
}

export interface TeamScoreRecord {
  roundScores: RoundScore[];
}

export interface TeamPlayers {
  team0: Player[];
  team1: Player[];
}

export interface GameActions {
  selectNegri: (card: string) => void;
  playCard: (card: string) => void;
  declareBlow: () => void;
  passBlow: () => void;
  selectBaseSuit: (suit: string) => void;
  revealBrokenHand: (playerId: string) => void;
} 

export function fromPlayerContract(player: PlayerContract): Player {
  const normalized = normalizePlayerIdentity(player);
  return {
    socketId: normalized.socketId,
    seatId: normalized.seatId,
    playerId: normalized.playerId,
    name: normalized.name,
    userId: normalized.userId,
    isAuthenticated: normalized.isAuthenticated,
    team: normalized.team,
    hand: [...normalized.hand],
    isHost: normalized.isHost,
    isPasser: normalized.isPasser,
    isCOM: normalized.isCOM,
    hasBroken: normalized.hasBroken ?? false,
    hasRequiredBroken: normalized.hasRequiredBroken ?? false,
  };
}

export function fromPlayerContracts(players: PlayerContract[]): Player[] {
  return players.map(fromPlayerContract);
}
