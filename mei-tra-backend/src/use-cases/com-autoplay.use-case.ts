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
        return await this.handleComBlowPhase(roomId, currentPlayer);
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

    const events = result.events ?? [];

    // フィールド完了チェック - turn-updated または field-cleared イベントがあれば継続
    const shouldContinue = events.some(
      (e) => e.event === 'turn-updated' || e.event === 'field-cleared',
    );

    return {
      success: result.success,
      events,
      shouldContinue,
      error: result.error,
    };
  }

  private async handleComBlowPhase(
    roomId: string,
    comPlayer: Player,
  ): Promise<ComAutoPlayResponse> {
    // COMは常にパス
    const result: PassBlowResponse = await this.passBlowUseCase.execute({
      roomId,
      socketId: comPlayer.id,
    });

    const events = result.events ?? [];

    // turn-updatedイベントがあれば次のCOMターンを継続
    const shouldContinue = events.some((e) => e.event === 'turn-updated');

    return {
      success: result.success,
      events,
      shouldContinue,
      error: result.error,
    };
  }
}
