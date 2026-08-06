import { AuthenticatedUser } from '../../types/user.types';
import {
  DomainPlayer,
  TeamScores,
  Field,
  GamePhase,
  BlowState,
  CompletedField,
  TeamNames,
} from '../../types/game.types';
import { Room, RoomStatus } from '../../types/room.types';
import { SessionUser } from '../../types/session.types';

type Nullable<T> = T | null | undefined;

export interface JoinRoomRequest {
  socketId: string;
  targetRoomId: string;
  currentRoomId?: string;
  authenticatedUser?: Nullable<AuthenticatedUser>;
}

export interface PreviousRoomNotification {
  roomId: string;
  playerId: string;
}

export interface ResumeGamePayload {
  message: string;
  gameState: {
    players: DomainPlayer[];
    gamePhase: GamePhase;
    currentField: Field | null;
    currentTurn: string | null;
    blowState: BlowState;
    teamScores: TeamScores;
    negriCard: string | null;
    fields: CompletedField[] | undefined;
    roomId: string;
    pointsToWin: number;
    teamNames?: TeamNames;
  };
}

export interface JoinRoomSuccess {
  room: Room;
  isHost: boolean;
  roomStatus: RoomStatus | undefined;
  roomsList: Room[];
  resumeGame?: ResumeGamePayload;
}

export interface JoinRoomResponse {
  success: boolean;
  errorMessage?: string;
  normalizedUser?: SessionUser;
  previousRoomNotification?: PreviousRoomNotification;
  data?: JoinRoomSuccess;
}

export interface IJoinRoomUseCase {
  execute(request: JoinRoomRequest): Promise<JoinRoomResponse>;
}
