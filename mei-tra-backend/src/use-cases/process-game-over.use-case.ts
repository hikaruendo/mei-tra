import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  IProcessGameOverUseCase,
  ProcessGameOverRequest,
} from './interfaces/process-game-over.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { SessionUser } from '../types/session.types';
import type { SeatId } from '@contracts/ids';
import type { ILeaderboardRepository } from '../repositories/interfaces/leaderboard.repository.interface';
import { rankedMatchAtGameOver } from '../domain/ranked-match';

@Injectable()
export class ProcessGameOverUseCase implements IProcessGameOverUseCase {
  private readonly logger = new Logger(ProcessGameOverUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
    @Optional()
    @Inject('ILeaderboardRepository')
    private readonly leaderboardRepository?: ILeaderboardRepository,
  ) {}

  async execute(request: ProcessGameOverRequest): Promise<void> {
    const { roomId, winningTeam, teamScores } = request;
    const room = await this.roomService.getRoom(roomId);
    if (!room) {
      return;
    }

    const roomGameState =
      typeof this.roomService.getRoomGameState === 'function'
        ? await this.roomService.getRoomGameState(roomId)
        : null;

    const authenticatedPlayers = room.players
      .map((roomPlayer) => {
        const sessionUser =
          roomGameState &&
          typeof roomGameState.findSessionUserBySeatId === 'function'
            ? roomGameState.findSessionUserBySeatId(roomPlayer.seatId)
            : null;
        const userId = this.resolveAuthenticatedUserId(roomPlayer, sessionUser);

        if (!userId) {
          return null;
        }

        return {
          seatId: roomPlayer.seatId,
          team: roomPlayer.team,
          userId,
        };
      })
      .filter(
        (
          player,
        ): player is {
          seatId: SeatId;
          team: 0 | 1;
          userId: string;
        } => player !== null,
      );

    const rankedMatch =
      this.leaderboardRepository &&
      roomGameState &&
      typeof roomGameState.getState === 'function'
        ? rankedMatchAtGameOver(room, roomGameState.getState(), winningTeam)
        : null;
    if (rankedMatch && this.leaderboardRepository) {
      try {
        await this.leaderboardRepository.record(
          rankedMatch.matchId,
          rankedMatch.mode,
          rankedMatch.players,
        );
      } catch (error) {
        this.logger.error('Failed to record ranked match', error);
      }
    }

    const updatePromises = authenticatedPlayers.map(async (player) => {
      const won = player.team === winningTeam;
      const playerScore = teamScores[player.team]?.total ?? 0;

      await this.roomService.updateUserGameStats(
        player.userId,
        won,
        playerScore,
      );

      return player;
    });

    const results = await Promise.allSettled(updatePromises);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Failed to update stats for user ${authenticatedPlayers[index].userId}:`,
          result.reason,
        );
      }
    });
    const updatedPlayers = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value.seatId] : [],
    );
    const failedUpdates = results.filter(
      (result) => result.status === 'rejected',
    ).length;

    await this.gameEventLogService?.log({
      roomId,
      actionType: 'player_stats_updated',
      actorSeatId: null,
      actionData: {
        winningTeam,
        updatedPlayers,
        updatedCount: updatedPlayers.length,
        skippedPlayers: room.players
          .filter(
            (roomPlayer) =>
              !authenticatedPlayers.some(
                (player) => player.seatId === roomPlayer.seatId,
              ),
          )
          .map((roomPlayer) => roomPlayer.seatId),
        failedCount: failedUpdates,
        finalScores: teamScores,
      },
    });

    await this.gameEventLogService?.pruneFinishedRoomHistory?.();
  }

  private resolveAuthenticatedUserId(
    roomPlayer: { userId?: string | null; isAuthenticated?: boolean },
    sessionUser: Pick<SessionUser, 'userId' | 'isAuthenticated'> | null,
  ): string | undefined {
    if (
      sessionUser?.isAuthenticated &&
      typeof sessionUser.userId === 'string' &&
      sessionUser.userId.length > 0
    ) {
      return sessionUser.userId;
    }

    if (typeof roomPlayer.userId === 'string' && roomPlayer.userId.length > 0) {
      return roomPlayer.userId;
    }

    return undefined;
  }
}
