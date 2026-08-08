import { Inject, Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import type {
  BackToLobbyPayload,
  ReconnectionFailureCode,
} from '@contracts/game';
import { AuthenticatedUser } from '../types/user.types';
import { IRoomService } from './interfaces/room-service.interface';
import { RoomUpdateGatewayEffectsService } from './room-update-gateway-effects.service';
import { SpectatorGatewayEffectsService } from './spectator-gateway-effects.service';

type PlayerRooms = Map<string, string>;

@Injectable()
export class ConnectionGatewayEffectsService {
  private readonly logger = new Logger(ConnectionGatewayEffectsService.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    private readonly roomUpdateGatewayEffectsService: RoomUpdateGatewayEffectsService,
    private readonly spectatorGatewayEffectsService: SpectatorGatewayEffectsService,
  ) {}

  async sendBackToLobby(params: {
    client: Socket;
    playerRooms: PlayerRooms;
    reason: string;
    code: ReconnectionFailureCode;
    roomId?: string;
  }): Promise<void> {
    const { client, playerRooms, reason, code, roomId } = params;
    this.logger.warn(
      `[Reconnection] Sending back-to-lobby for socket=${client.id} room=${roomId ?? 'none'} reason=${reason}`,
    );
    if (roomId) {
      await client.leave(roomId);
    }
    playerRooms.delete(client.id);
    await this.spectatorGatewayEffectsService.leaveCurrentRoom(client);
    const payload: BackToLobbyPayload = { code };
    client.emit('back-to-lobby', payload);
    client.emit(
      'rooms-list',
      this.roomUpdateGatewayEffectsService.buildRoomsListView(
        await this.roomService.listRooms(),
      ),
    );
  }

  async sendRoomPlayersBackToLobby(params: {
    server: Server;
    playerRooms: PlayerRooms;
    roomId: string;
  }): Promise<void> {
    const { server, playerRooms, roomId } = params;
    const socketIds = Array.from(playerRooms.entries())
      .filter(([, mappedRoomId]) => mappedRoomId === roomId)
      .map(([socketId]) => socketId);

    for (const socketId of socketIds) {
      await this.sendSocketBackToLobby({
        server,
        playerRooms,
        socketId,
        roomId,
      });
    }
  }

  async sendUserSocketsBackToLobby(params: {
    server: Server;
    playerRooms: PlayerRooms;
    roomId: string;
    userId: string | undefined;
    fallbackSocketId: string;
  }): Promise<void> {
    const { server, playerRooms, roomId, userId, fallbackSocketId } = params;
    const socketIds = Array.from(playerRooms.entries())
      .filter(([socketId, mappedRoomId]) => {
        if (mappedRoomId !== roomId) {
          return false;
        }
        if (!userId) {
          return socketId === fallbackSocketId;
        }
        const socket = server.sockets.sockets.get(socketId);
        return socket
          ? this.getAuthenticatedUser(socket)?.id === userId
          : false;
      })
      .map(([socketId]) => socketId);

    if (!socketIds.includes(fallbackSocketId)) {
      socketIds.push(fallbackSocketId);
    }

    for (const socketId of socketIds) {
      await this.sendSocketBackToLobby({
        server,
        playerRooms,
        socketId,
        roomId,
      });
    }
  }

  async sendSocketBackToLobby(params: {
    server: Server;
    playerRooms: PlayerRooms;
    socketId: string;
    roomId: string;
  }): Promise<void> {
    const { server, playerRooms, socketId, roomId } = params;
    playerRooms.delete(socketId);
    const socket = server.sockets.sockets.get(socketId);
    if (socket) {
      await socket.leave(roomId);
      socket.emit('back-to-lobby');
      return;
    }
    server.to(socketId).emit('back-to-lobby');
  }

  async findExistingControllerSocketId(params: {
    server: Server;
    playerRooms: PlayerRooms;
    roomId: string;
    userId: string;
  }): Promise<string | null> {
    const { server, playerRooms, roomId, userId } = params;
    const mappedSocketId = Array.from(playerRooms.entries()).find(
      ([socketId, mappedRoomId]) => {
        if (mappedRoomId !== roomId) {
          return false;
        }
        const socket = server.sockets.sockets.get(socketId);
        return socket
          ? this.getAuthenticatedUser(socket)?.id === userId
          : false;
      },
    )?.[0];
    if (mappedSocketId) {
      return mappedSocketId;
    }

    try {
      const room = await this.roomService.getRoom(roomId);
      const player = room?.players.find(
        (candidate) => candidate.isAuthenticated && candidate.userId === userId,
      );
      if (!player) {
        return null;
      }
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      return (
        roomGameState.getPlayerConnectionState(player.playerId)?.socketId ||
        player.socketId ||
        null
      );
    } catch (error) {
      this.logger.warn(
        `[Connection] Failed to resolve controller socket room=${roomId} user=${userId}: ${String(error)}`,
      );
      return null;
    }
  }

  private getAuthenticatedUser(socket: Socket): AuthenticatedUser | undefined {
    return (socket.data as { user?: AuthenticatedUser }).user;
  }
}
