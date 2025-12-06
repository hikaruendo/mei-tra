import { Injectable, Inject } from '@nestjs/common';
import {
  IComAutoPlayUseCase,
  ComAutoPlayRequest,
  ComAutoPlayResponse,
} from './interfaces/com-autoplay-use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IComPlayerService } from '../services/interfaces/com-player-service.interface';
import {
  IPlayCardUseCase,
  PlayCardResponse,
} from './interfaces/play-card.use-case.interface';
import {
  IPassBlowUseCase,
  PassBlowResponse,
} from './interfaces/pass-blow.use-case.interface';
import { Player } from '../types/game.types';
import { GameStateService } from '../services/game-state.service';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import { CompleteFieldTrigger } from './interfaces/play-card.use-case.interface';

type ResponseWithDelayed<T> = T & {
  delayedEvents?: GatewayEvent[];
  completeFieldTrigger?: CompleteFieldTrigger;
};

@Injectable()
export class ComAutoPlayUseCase implements IComAutoPlayUseCase {
  constructor(
    @Inject('IRoomService')
    private readonly roomService: IRoomService,
    @Inject('IComPlayerService')
    private readonly comPlayerService: IComPlayerService,
    @Inject('IPlayCardUseCase')
    private readonly playCardUseCase: IPlayCardUseCase,
    @Inject('IPassBlowUseCase')
    private readonly passBlowUseCase: IPassBlowUseCase,
  ) {}

  async execute(request: ComAutoPlayRequest): Promise<ComAutoPlayResponse> {
    const { roomId } = request;

    try {
      // 1. ゲーム状態取得
      const gameState = await this.roomService.getRoomGameState(roomId);
      const currentPlayer = gameState.getCurrentPlayer();

      // 2. COMプレイヤーでなければスキップ
      if (!currentPlayer || !this.comPlayerService.isComPlayer(currentPlayer)) {
        return { success: true, events: [], shouldContinue: false };
      }

      // 3. フェーズに応じた処理
      const phase = gameState.getState().gamePhase;

      if (phase === 'play') {
        return await this.handleComPlayPhase(roomId, currentPlayer, gameState);
      } else if (phase === 'blow') {
        return await this.handleComBlowPhase(roomId, currentPlayer, gameState);
      }

      return { success: true, events: [], shouldContinue: false };
    } catch (error) {
      return {
        success: false,
        events: [],
        shouldContinue: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleComPlayPhase(
    roomId: string,
    comPlayer: Player,
    gameState: GameStateService,
  ): Promise<ComAutoPlayResponse> {
    const state = gameState.getState();
    const currentField = state.playState?.currentField ?? null;
    const currentTrump = state.blowState?.currentTrump ?? null;

    const bestCard = this.comPlayerService.selectBestCard(
      comPlayer.hand,
      currentField,
      currentTrump,
    );

    const result: PlayCardResponse = await this.playCardUseCase.execute({
      roomId,
      socketId: comPlayer.id,
      card: bestCard,
    });

    const {
      events = [],
      delayedEvents = [],
      completeFieldTrigger,
    } = result as ResponseWithDelayed<PlayCardResponse>;

    // Continue if server advanced the turn or completed a field
    const shouldContinue =
      !completeFieldTrigger &&
      events.some(
        (e) => e.event === 'update-turn' || e.event === 'field-complete',
      );

    return {
      success: result.success,
      events,
      delayedEvents,
      completeFieldTrigger,
      shouldContinue,
      error: result.error,
    };
  }

  private async handleComBlowPhase(
    roomId: string,
    comPlayer: Player,
    gameState: GameStateService,
  ): Promise<ComAutoPlayResponse> {
    // COMは常にパス
    const result: PassBlowResponse = await this.passBlowUseCase.execute({
      roomId,
      socketId: comPlayer.id,
    });

    const { events = [], delayedEvents = [] } =
      result as ResponseWithDelayed<PassBlowResponse>;

    const nextPlayer = gameState.getCurrentPlayer();
    const state = gameState.getState();
    const shouldContinue =
      state.gamePhase === 'blow' &&
      !!nextPlayer &&
      this.comPlayerService.isComPlayer(nextPlayer);

    return {
      success: result.success,
      events,
      delayedEvents,
      revealBrokenRequest: result.revealBrokenRequest,
      shouldContinue,
      error: result.error,
    };
  }
}
