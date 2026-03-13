import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  ChangePlayerTeamRequest,
  ChangePlayerTeamResponse,
  IChangePlayerTeamUseCase,
} from './interfaces/change-player-team.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { Team } from '../types/game.types';

@Injectable()
export class ChangePlayerTeamUseCase implements IChangePlayerTeamUseCase {
  private readonly logger = new Logger(ChangePlayerTeamUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(
    request: ChangePlayerTeamRequest,
  ): Promise<ChangePlayerTeamResponse> {
    try {
      const { roomId, playerId, teamChanges } = request;
      const room = await this.roomService.getRoom(roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      // Find the requesting player
      const requestingPlayer = room.players.find(
        (p) => p.playerId === playerId,
      );
      if (!requestingPlayer) {
        return { success: false, error: 'Player not found in room' };
      }

      // Verify that the requesting player is the host
      if (room.hostId !== playerId) {
        return { success: false, error: 'Only the host can change teams' };
      }

      const currentTeamCounts = {
        0: room.players.filter((p) => !p.isCOM && p.team === 0).length,
        1: room.players.filter((p) => !p.isCOM && p.team === 1).length,
      } as Record<Team, number>;

      const newTeamCounts = { ...currentTeamCounts };
      for (const [playerId, newTeam] of Object.entries(teamChanges)) {
        const player = room.players.find((p) => p.playerId === playerId);
        if (!player) {
          return {
            success: false,
            error: `Player ${playerId} not found`,
          };
        }

        if (player.team === 0) newTeamCounts[0]--;
        if (player.team === 1) newTeamCounts[1]--;

        newTeamCounts[newTeam as Team]++;
      }

      if (newTeamCounts[0] > 2 || newTeamCounts[1] > 2) {
        return {
          success: false,
          error: 'Each team must have at most 2 players',
        };
      }

      // Persist each team change to room_players table via updatePlayerInRoom.
      // updateRoom() only saves rooms-table columns (name/hostId/status) and would
      // return stale team values fetched from room_players.
      for (const [pid, newTeam] of Object.entries(teamChanges)) {
        await this.roomService.updatePlayerInRoom(roomId, pid, {
          team: newTeam as Team,
        });
      }

      // Re-fetch room so updatedRoom.players reflects the persisted team changes.
      const updatedRoom = await this.roomService.getRoom(roomId);
      if (!updatedRoom) {
        return { success: false, error: 'Failed to retrieve updated room' };
      }

      return {
        success: true,
        updatedRoom,
      };
    } catch (error) {
      this.logger.error(
        'Unexpected error in ChangePlayerTeamUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }
}
