import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IProcessGameOverUseCase,
  ProcessGameOverRequest,
} from './interfaces/process-game-over.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';

@Injectable()
export class ProcessGameOverUseCase implements IProcessGameOverUseCase {
  private readonly logger = new Logger(ProcessGameOverUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(request: ProcessGameOverRequest): Promise<void> {
    const { roomId, players, winningTeam, teamScores, resetDelayMs } = request;

    const authenticatedPlayers = players.filter(
      (player): player is typeof player & { userId: string } =>
        typeof player.userId === 'string' && player.userId.length > 0,
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

    await Promise.allSettled(updatePromises);

    setTimeout(() => {
      void this.roomService
        .getRoomGameState(roomId)
        .then((gameState) => gameState.resetState())
        .catch((error) =>
          this.logger.error(
            'Failed to reset game state after game over:',
            error,
          ),
        );
    }, resetDelayMs);
  }
}
