import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import {
  IComAutoPlayUseCase,
  ComAutoPlayRequest,
  ComAutoPlayResponse,
} from './interfaces/com-autoplay-use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IComPlayerService } from '../services/interfaces/com-player-service.interface';
import { IComStrategyService } from '../services/interfaces/com-strategy-service.interface';
import {
  IPlayCardUseCase,
  PlayCardResponse,
} from './interfaces/play-card.use-case.interface';
import {
  DeclareBlowResponse,
  IDeclareBlowUseCase,
} from './interfaces/declare-blow.use-case.interface';
import {
  IPassBlowUseCase,
  PassBlowResponse,
} from './interfaces/pass-blow.use-case.interface';
import {
  ISelectNegriUseCase,
  SelectNegriResponse,
} from './interfaces/select-negri.use-case.interface';
import { IRevealBrokenHandUseCase } from './interfaces/reveal-broken-hand.use-case.interface';
import { transitionToPlayPhase } from './blow-phase-transition.helper';
import { countPlayersActedInBlow } from './helpers/blow-action.helper';
import { resolveCurrentSeatId } from '../types/current-turn';
import { IBlowService } from '../services/interfaces/blow-service.interface';
import { ICardService } from '../services/interfaces/card-service.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { DomainPlayer } from '../types/game.types';
import { GameStateService } from '../services/game-state.service';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import { CompleteFieldTrigger } from './interfaces/play-card.use-case.interface';
import {
  hasPlayerDeclaredInBlow,
  hasPlayerPassedInBlow,
} from './helpers/blow-action.helper';
import { getBrokenHandRevealPendingError } from './helpers/broken-hand.helper';

type ResponseWithDelayed<T> = T & {
  delayedEvents?: GatewayEvent[];
  completeFieldTrigger?: CompleteFieldTrigger;
};

@Injectable()
export class ComAutoPlayUseCase implements IComAutoPlayUseCase {
  private readonly logger = new Logger(ComAutoPlayUseCase.name);

  constructor(
    @Inject('IRoomService')
    private readonly roomService: IRoomService,
    @Inject('IComPlayerService')
    private readonly comPlayerService: IComPlayerService,
    @Inject('IComStrategyService')
    private readonly comStrategyService: IComStrategyService,
    @Inject('IPlayCardUseCase')
    private readonly playCardUseCase: IPlayCardUseCase,
    @Inject('IDeclareBlowUseCase')
    private readonly declareBlowUseCase: IDeclareBlowUseCase,
    @Inject('IPassBlowUseCase')
    private readonly passBlowUseCase: IPassBlowUseCase,
    @Inject('IBlowService')
    private readonly blowService: IBlowService,
    @Inject('ICardService')
    private readonly cardService: ICardService,
    @Inject('ISelectNegriUseCase')
    private readonly selectNegriUseCase: ISelectNegriUseCase,
    @Inject('IRevealBrokenHandUseCase')
    private readonly revealBrokenHandUseCase: IRevealBrokenHandUseCase,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
  ) {}

  // Skipping a human's turn is normal, so this stays quiet unless nobody can act:
  // auto-play declines (not a COM) AND the turn holder has no live socket. That
  // combination is a stalled table, and it is otherwise completely silent.
  private warnIfTurnIsUnplayable(
    roomId: string,
    gameState: GameStateService,
    currentPlayer: DomainPlayer | null,
  ): void {
    const state = gameState.getState();
    if (state.gamePhase !== 'play' && state.gamePhase !== 'blow') {
      return;
    }

    if (!currentPlayer) {
      this.logger.warn(
        `Turn unplayable in room ${roomId}: no current player resolved ` +
          `(currentSeatId=${resolveCurrentSeatId(state) ?? 'null'}, ` +
          `roster=[${state.players.map((player) => player.playerId).join(', ')}])`,
      );
      return;
    }

    const isConnected = Boolean(
      gameState.getPlayerConnectionState(currentPlayer.playerId)?.socketId,
    );
    if (isConnected) {
      return;
    }

    this.logger.warn(
      `Turn unplayable in room ${roomId}: auto-play skipped non-COM player ` +
        `${currentPlayer.playerId} which has no live socket ` +
        `(phase=${state.gamePhase}, currentSeatId=${resolveCurrentSeatId(state) ?? 'null'}, ` +
        `isCOM=${String(currentPlayer.isCOM)})`,
    );
  }

  async execute(request: ComAutoPlayRequest): Promise<ComAutoPlayResponse> {
    const { roomId } = request;

    try {
      // 1. ゲーム状態取得
      const gameState = await this.roomService.getRoomGameState(roomId);
      if (await getBrokenHandRevealPendingError(gameState)) {
        return { success: true, events: [], shouldContinue: false };
      }

      const currentPlayer = gameState.getCurrentPlayer();

      // 2. COMプレイヤーでなければスキップ
      if (!currentPlayer || !this.comPlayerService.isComPlayer(currentPlayer)) {
        this.warnIfTurnIsUnplayable(roomId, gameState, currentPlayer);
        return { success: true, events: [], shouldContinue: false };
      }

      // 3. フェーズに応じた処理
      const phase = gameState.getState().gamePhase;

      if (phase === 'play') {
        return await this.handleComPlayPhase(roomId, currentPlayer, gameState);
      } else if (phase === 'blow') {
        if (currentPlayer.hasRequiredBroken) {
          return await this.handleComRequiredBrokenHand(
            roomId,
            currentPlayer,
            gameState,
          );
        }

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
    comPlayer: DomainPlayer,
    gameState: GameStateService,
  ): Promise<ComAutoPlayResponse> {
    const state = gameState.getState();

    if (
      state.playState?.negriCard == null &&
      state.blowState.currentHighestDeclaration?.playerId === comPlayer.playerId
    ) {
      const negriCard = this.comStrategyService.chooseNegriCard(
        state,
        comPlayer,
      );

      if (!negriCard) {
        return {
          success: false,
          events: [],
          shouldContinue: false,
          error: 'COM has no card available to select as Negri',
        };
      }

      const negriResult: SelectNegriResponse =
        await this.selectNegriUseCase.execute({
          roomId,
          actorId: comPlayer.playerId,
          card: negriCard,
        });

      const negriEvents = negriResult.events ?? [];
      const nextPlayer = gameState.getCurrentPlayer();
      const shouldContinue =
        negriResult.success &&
        !!nextPlayer &&
        this.comPlayerService.isComPlayer(nextPlayer);

      return {
        success: negriResult.success,
        events: negriEvents,
        shouldContinue,
        error: negriResult.error,
      };
    }

    const bestCard = this.comStrategyService.choosePlayCard(state, comPlayer);

    const result: PlayCardResponse = await this.playCardUseCase.execute({
      roomId,
      actorId: comPlayer.playerId,
      card: bestCard,
    });

    const playResult = result as ResponseWithDelayed<PlayCardResponse>;
    const events: GatewayEvent[] = [...(playResult.events ?? [])];
    const delayedEvents: GatewayEvent[] = [...(playResult.delayedEvents ?? [])];
    const { completeFieldTrigger } = playResult;

    const updatedState = gameState.getState();
    const updatedField = updatedState.playState?.currentField ?? null;
    if (
      result.success &&
      updatedField &&
      updatedField.baseCard === 'JOKER' &&
      !updatedField.baseSuit &&
      updatedField.dealerId === comPlayer.playerId
    ) {
      updatedField.baseSuit = this.comStrategyService.chooseBaseSuit(
        updatedState,
        comPlayer,
      );

      events.push({
        scope: 'room',
        roomId,
        event: 'field-updated',
        payload: updatedField,
      });

      gameState.nextTurn();
      const nextPlayer = gameState.getCurrentPlayer();
      if (nextPlayer) {
        events.push({
          scope: 'room',
          roomId,
          event: 'update-turn',
          payload: nextPlayer.playerId,
        });
      }

      await gameState.saveState();
    }

    const nextPlayer = gameState.getCurrentPlayer();
    // Continue from the persisted turn owner instead of trusting only emitted
    // events; this keeps autoplay alive even when a use-case emits no turn event.
    const shouldContinue =
      !completeFieldTrigger &&
      result.success &&
      !!nextPlayer &&
      this.comPlayerService.isComPlayer(nextPlayer);

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
    comPlayer: DomainPlayer,
    gameState: GameStateService,
  ): Promise<ComAutoPlayResponse> {
    const action = this.comStrategyService.chooseBlowAction(
      gameState.getState(),
      comPlayer,
    );

    if (action.type === 'skip') {
      // The seat already declared, so the rules leave it no action. Move the
      // turn on instead of submitting one that will be rejected — retrying a
      // forbidden action is what previously wedged the table.
      return this.advanceBlowTurnPastActedPlayer(roomId, comPlayer, gameState);
    }

    const result: PassBlowResponse | DeclareBlowResponse =
      action.type === 'declare'
        ? await this.declareBlowUseCase.execute({
            roomId,
            actorId: comPlayer.playerId,
            declaration: action.declaration,
          })
        : await this.passBlowUseCase.execute({
            roomId,
            actorId: comPlayer.playerId,
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
      shouldContinue,
      error: result.error,
    };
  }

  /**
   * Advances the blow turn past a seat that has already acted, mirroring the
   * skip loop in declare-blow/pass-blow, and emits the resulting turn.
   */
  private async advanceBlowTurnPastActedPlayer(
    roomId: string,
    comPlayer: DomainPlayer,
    gameState: GameStateService,
  ): Promise<ComAutoPlayResponse> {
    const state = gameState.getState();

    // Everyone has acted, so there is no turn to move to — the blow phase is
    // over and simply never transitioned. This is reachable because the
    // all-acted check lives inside declare-blow/pass-blow, and a COM
    // replacement changes the roster without either of them running.
    if (
      countPlayersActedInBlow(state.players, state.blowState) >=
      state.players.length
    ) {
      this.logger.warn(
        `Blow phase in room ${roomId} had all players acted but never transitioned; completing it`,
      );

      const room = await this.roomService.getRoom(roomId);
      if (!room) {
        return {
          success: false,
          events: [],
          shouldContinue: false,
          error: 'Room not found',
        };
      }

      const transition = await transitionToPlayPhase({
        roomId,
        roomGameState: gameState,
        room,
        state,
        blowService: this.blowService,
        cardService: this.cardService,
        gameEventLogService: this.gameEventLogService,
      });

      return {
        success: true,
        events: transition.events,
        delayedEvents: transition.delayedEvents,
        shouldContinue: false,
      };
    }

    this.logger.warn(
      `Blow turn sat on ${comPlayer.playerId} in room ${roomId}, which has already declared; advancing the turn`,
    );

    const maxAttempts = state.players.length;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      gameState.nextTurn();
      const candidate = gameState.getCurrentPlayer();
      if (!candidate) break;

      const acted =
        hasPlayerDeclaredInBlow(state.blowState, candidate.playerId) ||
        hasPlayerPassedInBlow(state.blowState, candidate);
      if (!acted) break;
    }

    await gameState.saveState();

    const nextPlayer = gameState.getCurrentPlayer();
    const events: GatewayEvent[] = nextPlayer
      ? [
          {
            scope: 'room',
            roomId,
            event: 'update-turn',
            payload: nextPlayer.playerId,
          },
        ]
      : [];

    return {
      success: true,
      events,
      shouldContinue:
        !!nextPlayer && this.comPlayerService.isComPlayer(nextPlayer),
    };
  }

  private async handleComRequiredBrokenHand(
    roomId: string,
    comPlayer: DomainPlayer,
    gameState: GameStateService,
  ): Promise<ComAutoPlayResponse> {
    const preparation = await this.revealBrokenHandUseCase.prepare({
      roomId,
      actorId: comPlayer.playerId,
      playerId: comPlayer.playerId,
    });

    if (!preparation.success || !preparation.followUp) {
      return {
        success: false,
        events: [],
        shouldContinue: false,
        error: preparation.error ?? 'Failed to prepare COM broken hand reveal',
      };
    }

    const completion = await this.revealBrokenHandUseCase.finalize(
      preparation.followUp,
    );

    if (!completion.success) {
      return {
        success: false,
        events: [],
        shouldContinue: false,
        error: completion.error ?? 'Failed to finalize COM broken hand reveal',
      };
    }

    const nextPlayer = gameState.getCurrentPlayer();
    return {
      success: true,
      events: completion.events ?? [],
      shouldContinue:
        !!nextPlayer && this.comPlayerService.isComPlayer(nextPlayer),
    };
  }
}
