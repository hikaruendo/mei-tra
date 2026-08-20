import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IRoomService } from './interfaces/room-service.interface';
import { RoomMembershipService } from './room-membership.service';
import { ActiveRoomMembership } from '../types/room-membership.types';

@Injectable()
export class RoomMembershipReconcilerService implements OnModuleInit {
  private readonly logger = new Logger(RoomMembershipReconcilerService.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    private readonly roomMembershipService: RoomMembershipService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.reconcile();
    } catch (error) {
      this.logger.error(
        'Failed to reconcile active room memberships during startup',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async reconcile(): Promise<void> {
    const memberships = await this.roomMembershipService.list();
    const authoritativeMemberships = new Map(
      memberships.map((membership) => [membership.userId, membership]),
    );

    for (const membership of memberships) {
      if (!membership.roomId) {
        await this.cancelExpiredReservation(membership);
        continue;
      }

      const room = await this.roomService.getRoom(membership.roomId);
      const player = room?.players.find(
        (candidate) =>
          candidate.seatId === membership.seatId &&
          candidate.userId === membership.userId,
      );
      if (player) {
        continue;
      }

      const authenticatedRoomPlayers =
        room?.players.filter(
          (candidate) =>
            !candidate.isCOM && candidate.userId === membership.userId,
        ) ?? [];
      if (authenticatedRoomPlayers.length === 1) {
        const repaired = await this.roomMembershipService.claim(
          membership.userId,
          membership.roomId,
          authenticatedRoomPlayers[0].seatId,
        );
        if (repaired.result !== 'conflict') {
          authoritativeMemberships.set(membership.userId, repaired.membership);
          this.logger.warn(
            `[MembershipReconcile] Repaired seat identity user=${membership.userId} room=${membership.roomId} from=${membership.seatId} to=${authenticatedRoomPlayers[0].seatId}`,
          );
          continue;
        }
      }

      const result = await this.roomMembershipService.release(
        membership.userId,
        membership.roomId,
        membership.membershipVersion,
      );
      if (result === 'released') {
        authoritativeMemberships.delete(membership.userId);
        this.logger.warn(
          `[MembershipReconcile] Released orphan membership user=${membership.userId} room=${membership.roomId}`,
        );
      }
    }

    const rooms = await this.roomService.listRooms();
    for (const room of rooms) {
      for (const player of room.players) {
        if (!player.isAuthenticated || !player.userId) {
          continue;
        }
        const membership = authoritativeMemberships.get(player.userId);
        if (
          !membership?.roomId ||
          (membership.roomId === room.id && membership.seatId === player.seatId)
        ) {
          continue;
        }

        const removed = await this.roomService.leaveRoom(
          room.id,
          player.seatId,
        );
        if (removed) {
          this.logger.warn(
            `[MembershipReconcile] Removed duplicate seat user=${player.userId} room=${room.id} authoritativeRoom=${membership.roomId}`,
          );
        }
      }
    }
  }

  private async cancelExpiredReservation(
    membership: ActiveRoomMembership,
  ): Promise<void> {
    if (
      membership.status !== 'moving' ||
      Date.now() - membership.updatedAt.getTime() <= 2 * 60 * 1000
    ) {
      return;
    }
    await this.roomMembershipService.cancelReservation(
      membership.userId,
      membership.transitionId,
    );
  }
}
