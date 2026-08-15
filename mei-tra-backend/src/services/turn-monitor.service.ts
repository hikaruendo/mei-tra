import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Server } from 'socket.io';
import { IRoomService } from './interfaces/room-service.interface';
import { RoomStatus } from '../types/room.types';
import { resolveCurrentPlayer } from '../domain/current-turn';
import type { SeatId } from '../types/identity.types';

const TURN_ACK_PING_INTERVAL_MS = 15 * 1000;
const TURN_IDLE_WARNING_MS = 45 * 1000;
const TURN_IDLE_TO_COM_TIMEOUT_MS = 2 * 60 * 1000;

interface TurnAckMonitor {
  seatId: SeatId;
  roomId: string;
  playerName: string;
  socketId: string;
  server: Server;
  lastAckAt: number;
  pingInterval: NodeJS.Timeout;
  statusInterval: NodeJS.Timeout;
  idleEmitted: boolean;
}

@Injectable()
export class TurnMonitorService implements OnModuleDestroy {
  private readonly logger = new Logger(TurnMonitorService.name);
  private readonly monitors = new Map<string, TurnAckMonitor>();

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  onModuleDestroy(): void {
    for (const roomId of this.monitors.keys()) {
      this.clearMonitor(roomId);
    }
  }

  clearMonitor(roomId: string): void {
    const monitor = this.monitors.get(roomId);
    if (!monitor) {
      return;
    }

    clearInterval(monitor.pingInterval);
    clearInterval(monitor.statusInterval);
    this.monitors.delete(roomId);
  }

  isPlayerIdle(roomId: string, seatId: SeatId): boolean {
    const monitor = this.monitors.get(roomId);
    return Boolean(monitor && monitor.seatId === seatId && monitor.idleEmitted);
  }

  isMonitoringPlayer(roomId: string, seatId: SeatId): boolean {
    return this.monitors.get(roomId)?.seatId === seatId;
  }

  async startMonitor(
    roomId: string,
    seatId: SeatId,
    server: Server,
    onIdleTimeout: (roomId: string, seatId: SeatId) => Promise<void>,
  ): Promise<void> {
    this.clearMonitor(roomId);

    const room = await this.roomService.getRoom(roomId);
    if (room?.status !== RoomStatus.PLAYING) {
      return;
    }

    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();
    const currentPlayer = state.players.find(
      (candidate) => candidate.seatId === seatId,
    );

    const currentPlayerConnection = currentPlayer
      ? roomGameState.getPlayerConnectionState(currentPlayer.seatId)
      : null;

    if (
      !currentPlayer ||
      currentPlayer.isCOM ||
      !currentPlayerConnection?.socketId ||
      (state.gamePhase !== 'play' && state.gamePhase !== 'blow')
    ) {
      return;
    }

    const emitPing = () => {
      server.to(currentPlayerConnection.socketId).emit('turn-ping', {
        roomId,
        seatId,
      });
    };

    const monitor: TurnAckMonitor = {
      roomId,
      seatId,
      playerName: currentPlayer.name,
      socketId: currentPlayerConnection.socketId,
      server,
      lastAckAt: Date.now(),
      pingInterval: setInterval(emitPing, TURN_ACK_PING_INTERVAL_MS),
      statusInterval: setInterval(() => {
        void (async () => {
          if (!(await this.isTurnStillOwnedBySeat(roomId, seatId))) {
            this.clearMonitor(roomId);
            return;
          }

          const now = Date.now();
          const silenceMs = now - monitor.lastAckAt;

          if (!monitor.idleEmitted && silenceMs >= TURN_IDLE_WARNING_MS) {
            monitor.idleEmitted = true;
            server.to(roomId).emit('player-idle', {
              seatId,
              playerName: monitor.playerName,
              roomId,
            });
          }

          if (silenceMs >= TURN_IDLE_TO_COM_TIMEOUT_MS) {
            this.clearMonitor(roomId);
            try {
              await onIdleTimeout(roomId, seatId);
            } catch (error) {
              this.logger.error(
                '[TurnMonitor] Error converting idle player:',
                error,
              );
            }
          }
        })();
      }, 5000),
      idleEmitted: false,
    };

    this.monitors.set(roomId, monitor);
    emitPing();
  }

  async acknowledge(
    roomId: string,
    socketId: string,
    userId?: string,
  ): Promise<void> {
    const monitor = this.monitors.get(roomId);
    if (!monitor) {
      return;
    }

    const room = await this.roomService.getRoom(roomId);
    if (room?.status !== RoomStatus.PLAYING) {
      this.clearMonitor(roomId);
      return;
    }

    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();
    const currentPlayer = state.players.find(
      (player) => player.seatId === monitor.seatId,
    );
    const currentPlayerConnection = currentPlayer
      ? roomGameState.getPlayerConnectionState(currentPlayer.seatId)
      : null;
    const matchesCurrentTurnPlayer =
      currentPlayerConnection &&
      (currentPlayerConnection.socketId === socketId ||
        (Boolean(userId) && currentPlayerConnection.userId === userId));

    if (!matchesCurrentTurnPlayer) {
      return;
    }

    monitor.lastAckAt = Date.now();
    if (monitor.idleEmitted) {
      monitor.idleEmitted = false;
      monitor.server.to(roomId).emit('player-idle-cleared', {
        seatId: monitor.seatId,
        roomId,
      });
    }
  }

  private async isTurnStillOwnedBySeat(
    roomId: string,
    seatId: SeatId,
  ): Promise<boolean> {
    const room = await this.roomService.getRoom(roomId);
    if (room?.status !== RoomStatus.PLAYING) {
      return false;
    }

    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();
    const currentPlayer = resolveCurrentPlayer(state);

    return (
      (state.gamePhase === 'play' || state.gamePhase === 'blow') &&
      currentPlayer?.seatId === seatId
    );
  }
}
