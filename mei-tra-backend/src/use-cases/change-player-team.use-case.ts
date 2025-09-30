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
      const { roomId, teamChanges } = request;
      const room = await this.roomService.getRoom(roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      const hostPlayer = room.players.find((p) => p.playerId === room.hostId);
      if (!hostPlayer) {
        return { success: false, error: 'Only the host can change teams' };
      }

      const currentTeamCounts = {
        0: room.players.filter(
          (p) => !p.playerId.startsWith('dummy-') && p.team === 0,
        ).length,
        1: room.players.filter(
          (p) => !p.playerId.startsWith('dummy-') && p.team === 1,
        ).length,
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

      for (const [playerId, newTeam] of Object.entries(teamChanges)) {
        const player = room.players.find((p) => p.playerId === playerId);
        if (player) {
          player.team = newTeam as Team;
        }
      }

      room.updatedAt = new Date();
      await this.roomService.updateRoom(roomId, room);

      return {
        success: true,
        updatedRoom: room,
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
