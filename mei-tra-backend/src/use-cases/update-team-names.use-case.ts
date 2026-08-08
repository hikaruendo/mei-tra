import { Inject, Injectable } from '@nestjs/common';
import type { TeamNames } from '@contracts/game';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { Room, RoomStatus } from '../types/room.types';

const MAX_TEAM_NAME_LENGTH = 16;

function normalizeTeamName(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, MAX_TEAM_NAME_LENGTH);
}

@Injectable()
export class UpdateTeamNamesUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(request: {
    roomId: string;
    playerId: string;
    teamNames: TeamNames;
  }): Promise<{ success: boolean; updatedRoom?: Room; error?: string }> {
    const room = await this.roomService.getRoom(request.roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.status !== RoomStatus.WAITING) {
      return {
        success: false,
        error: 'Team names can only be changed while waiting',
      };
    }

    if (room.hostId !== request.playerId) {
      return { success: false, error: 'Only the host can change team names' };
    }

    const redTeamName = normalizeTeamName(request.teamNames[0]);
    const blackTeamName = normalizeTeamName(request.teamNames[1]);
    const teamNames: TeamNames = {
      ...(redTeamName ? { 0: redTeamName } : {}),
      ...(blackTeamName ? { 1: blackTeamName } : {}),
    };

    const updatedRoom = await this.roomService.updateRoom(room.id, {
      settings: {
        ...room.settings,
        teamNames,
      },
    });

    if (!updatedRoom) {
      return { success: false, error: 'Failed to update team names' };
    }

    return { success: true, updatedRoom };
  }
}
