import { Injectable, Logger, Inject } from '@nestjs/common';
import { IRoomService } from '../services/interfaces/room-service.interface';
import {
  ILeaveRoomUseCase,
  LeaveRoomRequest,
  LeaveRoomResponse,
  LeaveRoomSuccessData,
} from './interfaces/leave-room.use-case.interface';

@Injectable()
export class LeaveRoomUseCase implements ILeaveRoomUseCase {
  private readonly logger = new Logger(LeaveRoomUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(request: LeaveRoomRequest): Promise<LeaveRoomResponse> {
    try {
      const { playerId, roomId } = request;

      const room = await this.roomService.getRoom(roomId);
      if (!room) {
        return {
          success: false,
          errorMessage: 'Room not found',
        };
      }

      const player = room.players.find((p) => p.playerId === playerId);
      if (!player) {
        return {
          success: false,
          errorMessage: 'Player not found in room',
        };
      }

      const success = await this.roomService.leaveRoom(roomId, playerId);
      if (!success) {
        return {
          success: false,
          errorMessage: 'Failed to leave room',
        };
      }

      const roomsList = await this.roomService.listRooms();
      const roomExists = await this.roomService.getRoom(roomId);

      const baseResponse: LeaveRoomSuccessData = {
        playerId: player.playerId,
        roomDeleted: !roomExists,
        roomsList,
      };

      if (!roomExists) {
        return {
          success: true,
          data: baseResponse,
        };
      }

      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();

      // Preserve team assignment for returning players
      state.teamAssignments[player.playerId] = player.team;

      // state.players is empty during waiting room (populated only at startGame).
      // Fall back to the room's real (non-COM) players in that case.
      const updatedPlayers =
        state.players.length > 0
          ? state.players
          : (roomExists?.players.filter((p) => !p.isCOM) ?? []);

      return {
        success: true,
        data: {
          ...baseResponse,
          updatedPlayers,
          // dummyが空席を引き継ぐためゲームは継続 (gamePausedMessage は送らない)
        },
      };
    } catch (error) {
      this.logger.error(
        'Unexpected error while executing LeaveRoomUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        success: false,
        errorMessage: 'Internal server error',
      };
    }
  }
}
