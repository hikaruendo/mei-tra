import { Inject, Injectable, Logger } from '@nestjs/common';
import { GatewayEvent } from '../use-cases/interfaces/gateway-event.interface';
import { DomainPlayer, GamePhase } from '../types/game.types';
import { Room, RoomStatus } from '../types/room.types';
import { IRoomService } from './interfaces/room-service.interface';
import { RoomUpdateGatewayEffectsService } from './room-update-gateway-effects.service';
import { RoomMembershipService } from './room-membership.service';
import { ActiveRoomMembership } from '../types/room-membership.types';
import { asSeatId } from '../types/identity.types';
import { toBlowUpdatedPayload } from '../types/game-contract-adapters';

export type DisconnectTimeoutMode = 'convert-to-com' | 'remove-player';

export interface DisconnectPreparation {
  playerId: string;
  playerName: string;
  roomGameState: Awaited<ReturnType<IRoomService['getRoomGameState']>>;
  timeoutMode: DisconnectTimeoutMode;
  membership: ActiveRoomMembership | null;
  events: GatewayEvent[];
}

@Injectable()
export class DisconnectGatewayEffectsService {
  private readonly logger = new Logger(DisconnectGatewayEffectsService.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    private readonly roomUpdateGatewayEffectsService: RoomUpdateGatewayEffectsService,
    private readonly roomMembershipService: RoomMembershipService,
  ) {}

  async prepareDisconnect(params: {
    roomId: string;
    socketId: string;
    displayName?: string;
  }): Promise<DisconnectPreparation | null> {
    const { roomId, socketId, displayName } = params;
    const room = await this.roomService.getRoom(roomId);
    if (!room) {
      return null;
    }
    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();
    const players = await this.sanitizePlayers(
      roomId,
      state.players,
      roomGameState,
    );
    const player = this.findPlayerForDisconnect(
      socketId,
      roomGameState,
      room,
      players,
    );

    if (!player) {
      return null;
    }

    const roomPlayer = room.players.find(
      (candidate) => candidate.playerId === player.playerId,
    );
    const initialConnectionState = roomGameState.getPlayerConnectionState(
      player.playerId,
    );
    if (
      initialConnectionState?.socketId &&
      initialConnectionState.socketId !== socketId
    ) {
      return null;
    }

    const userId = roomPlayer?.userId ?? initialConnectionState?.userId;
    const membership = userId
      ? await this.roomMembershipService.markDisconnected(userId, roomId)
      : null;
    if (userId && !membership) {
      return null;
    }

    const latestConnectionState = roomGameState.getPlayerConnectionState(
      player.playerId,
    );
    if (
      latestConnectionState?.socketId &&
      latestConnectionState.socketId !== socketId
    ) {
      return null;
    }

    await roomGameState.applyPlayerConnectionState(player.playerId, {
      socketId: '',
    });

    const events = await this.buildImmediateEvents({
      roomId,
      player,
      playerName: displayName ?? player.name,
      room,
      roomGameState,
    });

    return {
      playerId: player.playerId,
      playerName: displayName ?? player.name,
      roomGameState,
      timeoutMode: this.resolveTimeoutMode(state.gamePhase),
      membership,
      events,
    };
  }

  async buildTimeoutEvents(params: {
    roomId: string;
    playerId: string;
    playerName: string;
    timeoutMode: DisconnectTimeoutMode;
    membership?: ActiveRoomMembership | null;
  }): Promise<GatewayEvent[]> {
    const { roomId, playerId, playerName, timeoutMode, membership } = params;
    const room = await this.roomService.getRoom(roomId);
    if (!room) {
      return [];
    }

    const timeoutMembership = membership
      ? await this.roomMembershipService.startDisconnectTimeout(
          membership.userId,
          roomId,
          membership.membershipVersion,
        )
      : null;
    if (membership && !timeoutMembership) {
      return [];
    }
    const timeoutMembershipMutation = timeoutMembership
      ? {
          type: 'complete-disconnect-timeout' as const,
          userId: timeoutMembership.userId,
          expectedVersion: timeoutMembership.membershipVersion,
          transitionId: timeoutMembership.transitionId,
        }
      : undefined;

    let succeeded = false;
    try {
      if (timeoutMode === 'remove-player') {
        const roomGameState = await this.roomService.getRoomGameState(roomId);
        if (roomGameState.getPlayerConnectionState(playerId)?.socketId) {
          return [];
        }

        succeeded = await this.roomService.leaveRoom(roomId, playerId, {
          releaseMembership: false,
          membershipMutation: timeoutMembershipMutation,
        });
        if (!succeeded) {
          return [];
        }

        const updatedRoom = await this.roomService.getRoom(roomId);
        if (!updatedRoom) {
          return [
            this.roomUpdateGatewayEffectsService.buildRoomsListEvent({
              rooms: await this.roomService.listRooms(),
              scope: 'all',
            }),
          ];
        }

        const updatedGameState =
          await this.roomService.getRoomGameState(roomId);
        return [
          ...(await this.roomUpdateGatewayEffectsService.buildRoomEvents({
            room: updatedRoom,
            statePlayers: updatedGameState.getState().players,
            scope: 'room',
            roomId,
          })),
          this.roomUpdateGatewayEffectsService.buildRoomsListEvent({
            rooms: await this.roomService.listRooms(),
            scope: 'all',
          }),
        ];
      }

      if (room.status !== RoomStatus.PLAYING) {
        return [];
      }

      succeeded = await this.roomService.convertPlayerToCOM(roomId, playerId, {
        requireDisconnected: true,
        releaseMembership: false,
        membershipMutation: timeoutMembershipMutation,
      });
      if (!succeeded) {
        return [];
      }

      const updatedRoom = await this.roomService.getRoom(roomId);
      const roomGameState = await this.roomService.getRoomGameState(roomId);

      const roomEvents = updatedRoom
        ? await this.roomUpdateGatewayEffectsService.buildRoomEvents({
            room: updatedRoom,
            statePlayers: roomGameState.getState().players,
            scope: 'room',
            roomId,
          })
        : [];
      const blowState = roomGameState.getState().blowState;

      return [
        {
          scope: 'room',
          roomId,
          event: 'player-converted-to-com',
          payload: {
            seatId: asSeatId(playerId),
            playerName,
            message: 'Player disconnected for too long - converted to COM',
          },
        },
        ...roomEvents,
        {
          scope: 'room',
          roomId,
          event: 'blow-updated',
          payload: toBlowUpdatedPayload(blowState),
        },
        this.roomUpdateGatewayEffectsService.buildRoomsListEvent({
          rooms: await this.roomService.listRooms(),
          scope: 'all',
        }),
      ];
    } finally {
      if (timeoutMembership && !succeeded) {
        await this.roomMembershipService.finishDisconnectTimeout(
          timeoutMembership,
          false,
        );
      }
    }
  }

  private async sanitizePlayers(
    roomId: string,
    rawPlayers: unknown,
    roomGameState: Awaited<ReturnType<IRoomService['getRoomGameState']>>,
  ): Promise<DomainPlayer[]> {
    const safePlayers = Array.isArray(rawPlayers)
      ? rawPlayers.filter((player): player is DomainPlayer => Boolean(player))
      : [];

    if (Array.isArray(rawPlayers) && safePlayers.length !== rawPlayers.length) {
      this.logger.warn(
        `Dropping malformed players from room ${roomId} during disconnect cleanup`,
      );
      roomGameState.getState().players = safePlayers;
      await roomGameState.saveState();
    }

    return safePlayers;
  }

  private findPlayerForDisconnect(
    socketId: string,
    roomGameState: Awaited<ReturnType<IRoomService['getRoomGameState']>>,
    room: Room | null,
    players: DomainPlayer[],
  ): DomainPlayer | null {
    const disconnectedSessionUser =
      roomGameState.findSessionUserBySocketId(socketId);
    if (disconnectedSessionUser) {
      return (
        players.find(
          (candidate) => candidate.seatId === disconnectedSessionUser.seatId,
        ) ?? null
      );
    }

    const roomPlayer = room?.players.find(
      (candidate) => candidate.socketId === socketId,
    );
    if (!roomPlayer) {
      return null;
    }

    return (
      players.find((candidate) => candidate.playerId === roomPlayer.playerId) ??
      null
    );
  }

  private async buildImmediateEvents(params: {
    roomId: string;
    player: DomainPlayer;
    playerName: string;
    room: Room | null;
    roomGameState: Awaited<ReturnType<IRoomService['getRoomGameState']>>;
  }): Promise<GatewayEvent[]> {
    const { roomId, player, playerName, roomGameState } = params;
    let room = params.room;
    const events: GatewayEvent[] = [];

    if (room?.hostSeatId === player.playerId) {
      const nextHost = room.players.find(
        (candidate) =>
          candidate.playerId !== player.playerId && !candidate.isCOM,
      );
      if (nextHost) {
        await this.roomService.updateRoom(roomId, {
          hostSeatId: asSeatId(nextHost.playerId),
        });
        room = await this.roomService.getRoom(roomId);
        if (room) {
          events.push(
            ...(await this.roomUpdateGatewayEffectsService.buildRoomEvents({
              room,
              statePlayers: roomGameState.getState().players,
              scope: 'room',
              roomId,
            })),
          );
        }
        events.push(
          this.roomUpdateGatewayEffectsService.buildRoomsListEvent({
            rooms: await this.roomService.listRooms(),
            scope: 'all',
          }),
        );
      }
    }

    events.push(
      ...this.buildDisconnectRoomSyncEvents({
        roomId,
        player,
        playerName,
        room,
        roomGameState,
      }),
    );

    return events;
  }

  private buildDisconnectRoomSyncEvents(params: {
    roomId: string;
    player: DomainPlayer;
    playerName: string;
    room: Room | null;
    roomGameState: Awaited<ReturnType<IRoomService['getRoomGameState']>>;
  }): GatewayEvent[] {
    const { roomId, player, playerName, room, roomGameState } = params;

    return [
      {
        scope: 'room',
        roomId,
        event: 'player-left',
        payload: {
          seatId: asSeatId(player.playerId),
          roomId,
        },
      },
      {
        scope: 'room',
        roomId,
        event: 'player-disconnected',
        payload: {
          seatId: asSeatId(player.playerId),
          playerName,
          roomId,
        },
      },
      {
        ...this.roomUpdateGatewayEffectsService.buildPlayersEvent({
          players: roomGameState.getTransportPlayers(
            roomGameState.getState().players,
            room?.players,
          ),
          scope: 'room',
          roomId,
        }),
      },
    ];
  }

  private resolveTimeoutMode(gamePhase: GamePhase): DisconnectTimeoutMode {
    return gamePhase === 'play' || gamePhase === 'blow'
      ? 'convert-to-com'
      : 'remove-player';
  }
}
