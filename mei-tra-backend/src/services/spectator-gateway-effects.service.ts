import { Inject, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RoomContract } from '@contracts/room';
import { toRoomContract } from '../types/room-adapters';
import { IWatchRoomUseCase } from '../use-cases/interfaces/watch-room.use-case.interface';

interface WatchRoomGatewayResponse {
  success: boolean;
  error?: string;
  room?: RoomContract;
}

@Injectable()
export class SpectatorGatewayEffectsService {
  private readonly spectatorRooms = new Map<string, string>();
  private readonly snapshotTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject('IWatchRoomUseCase')
    private readonly watchRoomUseCase: IWatchRoomUseCase,
  ) {}

  isSpectatorSocket(socketId: string): boolean {
    return this.spectatorRooms.has(socketId);
  }

  rejectAction(client: Socket, actionName: string): boolean {
    if (!this.isSpectatorSocket(client.id)) {
      return false;
    }

    client.emit('error-message', `Spectators cannot ${actionName}`);
    return true;
  }

  async watchRoom(
    client: Socket,
    roomId: string,
  ): Promise<WatchRoomGatewayResponse> {
    const currentRoomId = this.spectatorRooms.get(client.id);
    if (currentRoomId && currentRoomId !== roomId) {
      await client.leave(this.getRoomName(currentRoomId));
    }

    const result = await this.watchRoomUseCase.execute({ roomId });
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error ?? 'Failed to watch room',
      };
    }

    this.spectatorRooms.set(client.id, roomId);
    await client.join(this.getRoomName(roomId));
    client.emit('game-state', result.data.gameState);

    return {
      success: true,
      room: toRoomContract(result.data.room),
    };
  }

  async leaveCurrentRoom(client: Socket): Promise<void> {
    const roomId = this.spectatorRooms.get(client.id);
    if (!roomId) {
      return;
    }

    this.spectatorRooms.delete(client.id);
    await client.leave(this.getRoomName(roomId));
  }

  async leaveRoom(client: Socket, roomId: string): Promise<boolean> {
    const currentRoomId = this.spectatorRooms.get(client.id);
    if (currentRoomId !== roomId) {
      return false;
    }

    await this.leaveCurrentRoom(client);
    client.emit('back-to-lobby');
    return true;
  }

  async handleDisconnect(client: Socket): Promise<boolean> {
    if (!this.isSpectatorSocket(client.id)) {
      return false;
    }

    await this.leaveCurrentRoom(client);
    return true;
  }

  async sendRoomBackToLobby(server: Server, roomId: string): Promise<void> {
    const roomName = this.getRoomName(roomId);
    const socketIds = Array.from(
      server.sockets.adapter.rooms.get(roomName) ?? [],
    );

    for (const socketId of socketIds) {
      const socket = server.sockets.sockets.get(socketId);
      this.spectatorRooms.delete(socketId);

      if (socket) {
        await socket.leave(roomName);
        server.to(socketId).emit('back-to-lobby');
      }
    }
  }

  queueSnapshot(server: Server, roomId: string): void {
    if (this.snapshotTimers.has(roomId)) {
      return;
    }

    const timer = setTimeout(() => {
      this.snapshotTimers.delete(roomId);
      void this.emitSnapshot(server, roomId);
    }, 0);
    this.snapshotTimers.set(roomId, timer);
  }

  private getRoomName(roomId: string): string {
    return `spectators:${roomId}`;
  }

  private async emitSnapshot(server: Server, roomId: string): Promise<void> {
    const roomName = this.getRoomName(roomId);
    const socketIds = server.sockets.adapter.rooms.get(roomName);
    if (!socketIds || socketIds.size === 0) {
      return;
    }

    const snapshot = await this.watchRoomUseCase.buildSnapshot(roomId);
    if (!snapshot) {
      return;
    }

    server.to(roomName).emit('game-state', snapshot);
  }
}
