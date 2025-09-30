import { Room } from '../../types/room.types';

export interface ChangePlayerTeamRequest {
  roomId: string;
  teamChanges: { [playerId: string]: number };
}

export interface ChangePlayerTeamResponse {
  success: boolean;
  error?: string;
  updatedRoom?: Room;
}

export interface IChangePlayerTeamUseCase {
  execute(request: ChangePlayerTeamRequest): Promise<ChangePlayerTeamResponse>;
}
