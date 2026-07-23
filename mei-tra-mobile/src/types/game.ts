import type {
  BlowStateContract,
  CompletedFieldContract,
  FieldContract,
  PlayerContract,
  TransportGamePhase,
  TransportTeamScores,
} from '@meitra/contracts/game';

export interface MobileGameSnapshot {
  roomId: string;
  players: PlayerContract[];
  gamePhase: TransportGamePhase;
  currentField: FieldContract | null;
  currentTurn: string | null;
  blowState: BlowStateContract;
  teamScores: TransportTeamScores;
  you: string | null;
  isSpectator: boolean;
  negriCard: string | null;
  negriPlayerId: string | null;
  revealedAgari: string | null;
  fields: CompletedFieldContract[];
  hostId: string | null;
  pointsToWin: number;
  paused: boolean;
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
