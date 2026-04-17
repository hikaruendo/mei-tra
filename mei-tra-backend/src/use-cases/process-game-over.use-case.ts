import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  IProcessGameOverUseCase,
  ProcessGameOverRequest,
} from './interfaces/process-game-over.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { SessionUser } from '../types/session.types';

@Injectable()
export class ProcessGameOverUseCase implements IProcessGameOverUseCase {
  private readonly logger = new Logger(ProcessGameOverUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
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
          typeof roomGameState.findSessionUserByPlayerId === 'function'
            ? roomGameState.findSessionUserByPlayerId(roomPlayer.playerId)
            : null;
        const userId = this.resolveAuthenticatedUserId(roomPlayer, sessionUser);

        if (!userId) {
          return null;
        }

        return {
          playerId: roomPlayer.playerId,
          team: roomPlayer.team,
          userId,
        };
      })
      .filter(
        (player): player is { playerId: string; team: 0 | 1; userId: string } =>
          player !== null,
      );

    const updatePromises = authenticatedPlayers.map(async (player) => {
      const won = player.team === winningTeam;
      const playerScore = teamScores[player.team]?.total ?? 0;

      try {
        await this.roomService.updateUserGameStats(
          player.userId,
          won,
          playerScore,
        );
      } catch (error) {
        this.logger.error(
          `Failed to update stats for user ${player.userId}:`,
          error,
        );
      }
    });

    const results = await Promise.allSettled(updatePromises);
    const failedUpdates = results.filter(
      (result) => result.status === 'rejected',
    ).length;

    await this.gameEventLogService?.log({
      roomId,
      actionType: 'player_stats_updated',
      playerId: null,
      actionData: {
        winningTeam,
        updatedPlayers: authenticatedPlayers.map((player) => player.playerId),
        updatedCount: authenticatedPlayers.length,
        skippedPlayers: room.players
          .filter(
            (roomPlayer) =>
              !authenticatedPlayers.some(
                (player) => player.playerId === roomPlayer.playerId,
              ),
          )
          .map((roomPlayer) => roomPlayer.playerId),
        failedCount: failedUpdates,
        finalScores: teamScores,
      },
    });
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

    if (
      roomPlayer.isAuthenticated &&
      typeof roomPlayer.userId === 'string' &&
      roomPlayer.userId.length > 0
    ) {
      return roomPlayer.userId;
    }

    return undefined;
  }
}
