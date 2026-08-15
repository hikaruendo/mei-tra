import { Room } from '../../types/room.types';
import type { SeatId } from '../../types/identity.types';

export interface ChangePlayerTeamRequest {
  roomId: string;
  actorSeatId: SeatId;
  teamChanges: { [seatId: string]: number };
}

export interface ChangePlayerTeamResponse {
  success: boolean;
  error?: string;
  updatedRoom?: Room;
}

export interface IChangePlayerTeamUseCase {
  execute(request: ChangePlayerTeamRequest): Promise<ChangePlayerTeamResponse>;
}
