import type {
  BlowStateContract,
  CompletedFieldContract,
  FieldContract,
  PlayerContract,
  TeamNames,
  TransportGamePhase,
  TransportTeamScores,
} from '@meitra/contracts/game';
import type { SeatId } from '@meitra/contracts/ids';

export interface MobileGameSnapshot {
  roomId: string;
  players: PlayerContract[];
  gamePhase: TransportGamePhase;
  currentField: FieldContract | null;
  currentTurnSeatId: SeatId | null;
  currentTurn: string | null;
  blowState: BlowStateContract;
  teamScores: TransportTeamScores;
  youSeatId: SeatId | null;
  you: string | null;
  isSpectator: boolean;
  negriCard: string | null;
  negriSeatId: SeatId | null;
  /** @deprecated Use negriSeatId. */
  negriPlayerId: string | null;
  revealedAgari: string | null;
  fields: CompletedFieldContract[];
  hostSeatId: SeatId | null;
  hostId: string | null;
  pointsToWin: number;
  paused: boolean;
  disconnectedPlayerIds: string[];
  idlePlayerIds: string[];
  teamNames?: TeamNames;
}

export interface MobileGameOver {
  winner: string;
  finalScores: TransportTeamScores;
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'resyncing'
  | 'connected';
