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
import type { RoomContract } from '@meitra/contracts/room';

export type MobilePlayer = PlayerContract;
export type MobileRoom = RoomContract;

export interface MobileGameSnapshot {
  roomId: string;
  players: MobilePlayer[];
  gamePhase: TransportGamePhase;
  currentField: FieldContract | null;
  currentTurnSeatId: SeatId | null;
  blowState: BlowStateContract;
  teamScores: TransportTeamScores;
  youSeatId: SeatId | null;
  isSpectator: boolean;
  negriCard: string | null;
  negriSeatId: SeatId | null;
  revealedAgari: string | null;
  fields: CompletedFieldContract[];
  hostSeatId: SeatId | null;
  pointsToWin: number;
  paused: boolean;
  disconnectedSeatIds: string[];
  idleSeatIds: string[];
  teamNames?: TeamNames;
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'resyncing'
  | 'connected';
