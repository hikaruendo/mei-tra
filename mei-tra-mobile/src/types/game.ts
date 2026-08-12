import type {
  PlayerContract,
  TeamNames,
  TransportGamePhase,
  TransportTeamScores,
} from '@meitra/contracts/game';
import type { SeatId } from '@meitra/contracts/ids';
import type {
  CanonicalBlowState,
  CanonicalCompletedFieldContract,
  CanonicalFieldContract,
  CanonicalPlayerContract,
  CanonicalRoomContract,
} from '@meitra/game-client/identity';

export type MobilePlayer = CanonicalPlayerContract<PlayerContract>;
export type MobileRoom = CanonicalRoomContract;

export interface MobileGameSnapshot {
  roomId: string;
  players: MobilePlayer[];
  gamePhase: TransportGamePhase;
  currentField: CanonicalFieldContract | null;
  currentTurnSeatId: SeatId | null;
  blowState: CanonicalBlowState;
  teamScores: TransportTeamScores;
  youSeatId: SeatId | null;
  isSpectator: boolean;
  negriCard: string | null;
  negriSeatId: SeatId | null;
  revealedAgari: string | null;
  fields: CanonicalCompletedFieldContract[];
  hostSeatId: SeatId | null;
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
