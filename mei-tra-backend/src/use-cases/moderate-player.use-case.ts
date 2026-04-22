import { Inject, Injectable } from '@nestjs/common';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { ILeaveRoomUseCase } from './interfaces/leave-room.use-case.interface';
import { RoomStatus } from '../types/room.types';
import { TransportPlayer } from '../types/player-adapters';
import { resolveRoomTransportPlayers } from './helpers/player-resolution.helper';

export type ModeratePlayerResult =
  | {
      success: true;
      mode: 'remove';
      targetSocketId?: string;
      playerId: string;
      roomDeleted: boolean;
      roomsList: Awaited<ReturnType<IRoomService['listRooms']>>;
      updatedRoom?: Awaited<ReturnType<IRoomService['getRoom']>>;
      updatedPlayers?: TransportPlayer[];
    }
  | {
      success: true;
      mode: 'replace-with-com';
      targetSocketId?: string;
      playerId: string;
      playerName: string;
      message: string;
      updatedRoom: NonNullable<Awaited<ReturnType<IRoomService['getRoom']>>>;
      updatedPlayers: TransportPlayer[];
      roomsList: Awaited<ReturnType<IRoomService['listRooms']>>;
    }
  | { success: false; error: string };

@Injectable()
export class ModeratePlayerUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('ILeaveRoomUseCase')
    private readonly leaveRoomUseCase: ILeaveRoomUseCase,
  ) {}

  async execute(request: {
    roomId: string;
    requesterPlayerId: string;
    targetPlayerId: string;
    action: 'remove' | 'replace-with-com';
    isPlayerIdle: boolean;
  }): Promise<ModeratePlayerResult> {
    const room = await this.roomService.getRoom(request.roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.hostId !== request.requesterPlayerId) {
      return { success: false, error: 'Only the host can moderate players' };
    }

    if (request.requesterPlayerId === request.targetPlayerId) {
      return { success: false, error: 'Host cannot moderate themselves' };
    }

    const targetPlayer = room.players.find(
      (player) => player.playerId === request.targetPlayerId,
    );
    if (!targetPlayer || targetPlayer.isCOM) {
      return { success: false, error: 'Target player not found' };
    }

    const roomGameState = await this.roomService.getRoomGameState(
      request.roomId,
    );
    const targetConnectionState = roomGameState.getPlayerConnectionState(
      request.targetPlayerId,
    );

    if (request.action === 'remove') {
      if (room.status !== RoomStatus.WAITING) {
        return {
          success: false,
          error: 'Players can only be removed in the waiting room',
        };
      }

      const result = await this.leaveRoomUseCase.execute({
        playerId: request.targetPlayerId,
        roomId: request.roomId,
      });
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.errorMessage || 'Failed to remove player',
        };
      }

      const updatedRoom = result.data.roomDeleted
        ? null
        : await this.roomService.getRoom(request.roomId);

      return {
        success: true,
        mode: 'remove',
        targetSocketId: targetConnectionState?.socketId || undefined,
        playerId: result.data.playerId,
        roomDeleted: result.data.roomDeleted,
        roomsList: result.data.roomsList,
        updatedRoom: updatedRoom ?? undefined,
        updatedPlayers: result.data.updatedPlayers,
      };
    }

    const state = roomGameState.getState();
    const targetStatePlayer = state.players.find(
      (player) => player.playerId === request.targetPlayerId,
    );
    const canReplaceDisconnected = Boolean(
      room.status === RoomStatus.PLAYING &&
        targetStatePlayer &&
        !targetConnectionState?.socketId,
    );
    const canReplaceIdle = Boolean(
      room.status === RoomStatus.PLAYING &&
        targetStatePlayer &&
        request.isPlayerIdle,
    );

    if (!canReplaceDisconnected && !canReplaceIdle) {
      return {
        success: false,
        error:
          'Only disconnected or idle in-game players can be replaced with COM',
      };
    }

    const converted = await this.roomService.convertPlayerToCOM(
      request.roomId,
      request.targetPlayerId,
    );
    if (!converted) {
      return { success: false, error: 'Failed to replace player with COM' };
    }

    const updatedRoom = await this.roomService.getRoom(request.roomId);
    if (!updatedRoom) {
      return { success: false, error: 'Room not found' };
    }

    return {
      success: true,
      mode: 'replace-with-com',
      targetSocketId: targetConnectionState?.socketId || undefined,
      playerId: request.targetPlayerId,
      playerName: targetPlayer.name,
      message: canReplaceIdle
        ? 'Host replaced an unresponsive player with COM'
        : 'Host replaced a disconnected player with COM',
      updatedRoom,
      updatedPlayers: resolveRoomTransportPlayers(roomGameState, updatedRoom, {
        statePlayers: roomGameState.getState().players,
      }),
      roomsList: await this.roomService.listRooms(),
    };
  }
}
