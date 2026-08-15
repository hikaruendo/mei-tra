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
  name: string;
  userId?: string; // Canonical authenticated account ID
  isAuthenticated?: boolean;
  profileRevision?: number;
}

export interface CompletedField {
  cards: string[];
  winnerSeatId: SeatId;
  winnerTeam: Team;
  dealerSeatId: SeatId;
}

export interface Field {
  cards: string[];
  playedBySeatIds: SeatId[];
  baseCard: string;
  baseSuit?: string;
  dealerSeatId: SeatId;
  isComplete: boolean;
}

// Update socket event types
export interface FieldCompleteEvent {
  winnerSeatId: SeatId;
  field: CompletedField;
  nextSeatId: SeatId;
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
  lastPasserSeatId: SeatId | null;
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
