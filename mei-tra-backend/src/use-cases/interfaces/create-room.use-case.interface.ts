import { AuthenticatedUser } from '../../types/user.types';
import { Room } from '../../types/room.types';

export interface CreateRoomRequest {
  clientId: string;
  roomName: string;
  pointsToWin: number;
  teamAssignmentMethod: 'random' | 'host-choice';
  playerName?: string;
  authenticatedUser?: AuthenticatedUser | null;
}

export interface CreateRoomResponse {
  success: boolean;
  errorMessage?: string;
  data?: {
    room: Room;
    roomsList: Room[];
  };
}

export interface ICreateRoomUseCase {
  execute(request: CreateRoomRequest): Promise<CreateRoomResponse>;
}
