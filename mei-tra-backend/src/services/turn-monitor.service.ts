import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Server } from 'socket.io';
import { IRoomService } from './interfaces/room-service.interface';
import { RoomStatus } from '../types/room.types';

const TURN_ACK_PING_INTERVAL_MS = 15 * 1000;
const TURN_IDLE_WARNING_MS = 45 * 1000;
const TURN_IDLE_TO_COM_TIMEOUT_MS = 2 * 60 * 1000;

interface TurnAckMonitor {
  playerId: string;
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

  isPlayerIdle(roomId: string, playerId: string): boolean {
    const monitor = this.monitors.get(roomId);
    return Boolean(
      monitor && monitor.playerId === playerId && monitor.idleEmitted,
    );
  }

  isMonitoringPlayer(roomId: string, playerId: string): boolean {
    return this.monitors.get(roomId)?.playerId === playerId;
  }

  async startMonitor(
    roomId: string,
    playerId: string,
    server: Server,
    onIdleTimeout: (roomId: string, playerId: string) => Promise<void>,
  ): Promise<void> {
    this.clearMonitor(roomId);

    const room = await this.roomService.getRoom(roomId);
    if (room?.status !== RoomStatus.PLAYING) {
      return;
    }

    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();
    const currentPlayer = state.players.find(
      (candidate) => candidate.playerId === playerId,
    );

    const currentPlayerConnection = currentPlayer
      ? roomGameState.getPlayerConnectionState(currentPlayer.playerId)
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
        playerId,
      });
    };

    const monitor: TurnAckMonitor = {
      roomId,
      playerId,
      playerName: currentPlayer.name,
      socketId: currentPlayerConnection.socketId,
      server,
      lastAckAt: Date.now(),
      pingInterval: setInterval(emitPing, TURN_ACK_PING_INTERVAL_MS),
      statusInterval: setInterval(() => {
        void (async () => {
          if (!(await this.isTurnStillOwnedByPlayer(roomId, playerId))) {
            this.clearMonitor(roomId);
            return;
          }

          const now = Date.now();
          const silenceMs = now - monitor.lastAckAt;

          if (!monitor.idleEmitted && silenceMs >= TURN_IDLE_WARNING_MS) {
            monitor.idleEmitted = true;
            server.to(roomId).emit('player-idle', {
              playerId,
              playerName: monitor.playerName,
              roomId,
            });
          }

          if (silenceMs >= TURN_IDLE_TO_COM_TIMEOUT_MS) {
            this.clearMonitor(roomId);
            try {
              await onIdleTimeout(roomId, playerId);
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

    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();
    const currentPlayer = state.players.find(
      (player) => player.playerId === monitor.playerId,
    );
    const currentPlayerConnection = currentPlayer
      ? roomGameState.getPlayerConnectionState(currentPlayer.playerId)
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
        playerId: monitor.playerId,
        roomId,
      });
    }
  }

  private async isTurnStillOwnedByPlayer(
    roomId: string,
    playerId: string,
  ): Promise<boolean> {
    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();
    const currentPlayer = state.players[state.currentPlayerIndex];

    return (
      (state.gamePhase === 'play' || state.gamePhase === 'blow') &&
      currentPlayer?.playerId === playerId
    );
  }
}
