import { AuthenticatedUser } from '../../types/user.types';
import {
  User,
  Player,
  TeamScores,
  Field,
  GamePhase,
  BlowState,
  CompletedField,
} from '../../types/game.types';
import { Room, RoomStatus } from '../../types/room.types';

type Nullable<T> = T | null | undefined;

export interface JoinRoomRequest {
  socketId: string;
  targetRoomId: string;
  currentRoomId?: string;
  user: User;
  authenticatedUser?: Nullable<AuthenticatedUser>;
}

export interface PreviousRoomNotification {
  roomId: string;
  playerId: string;
}

export interface ResumeGamePayload {
  message: string;
  gameState: {
    players: Player[];
    gamePhase: GamePhase;
    currentField: Field | null;
    currentTurn: string | null;
    blowState: BlowState;
    teamScores: TeamScores;
    negriCard: string | null;
    fields: CompletedField[] | undefined;
    roomId: string;
    pointsToWin: number;
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
  normalizedUser?: User;
  previousRoomNotification?: PreviousRoomNotification;
  data?: JoinRoomSuccess;
}

export interface IJoinRoomUseCase {
  execute(request: JoinRoomRequest): Promise<JoinRoomResponse>;
}
