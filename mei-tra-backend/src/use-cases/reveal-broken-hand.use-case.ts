import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { BrokenPayload } from '@contracts/game';
import {
  IRevealBrokenHandUseCase,
  RevealBrokenHandRequest,
  RevealBrokenHandPreparation,
  RevealBrokenHandCompletion,
} from './interfaces/reveal-broken-hand.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { ICardService } from '../services/interfaces/card-service.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import {
  resolvePlayerByActorId,
  resolveTransportPlayers,
} from './helpers/player-resolution.helper';
import { getBrokenHandRevealPendingError } from './helpers/broken-hand.helper';
import { asSeatId } from '../types/identity.types';
import type { SeatId } from '../types/identity.types';
import { setCurrentSeat } from '../domain/current-turn';

@Injectable()
export class RevealBrokenHandUseCase implements IRevealBrokenHandUseCase {
  private readonly logger = new Logger(RevealBrokenHandUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('ICardService') private readonly cardService: ICardService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
  ) {}

  async prepare(
    request: RevealBrokenHandRequest,
  ): Promise<RevealBrokenHandPreparation> {
    try {
      const { roomId, actorId, seatId } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const player = resolvePlayerByActorId(roomGameState, actorId);

      if (!player) {
        return { success: false, error: 'Player not found in game state' };
      }

      if (player.seatId !== seatId) {
        return { success: false, error: 'Player mismatch for broken hand' };
      }

      if (state.gamePhase !== 'blow') {
        return { success: false, error: 'Cannot reveal broken hand now' };
      }

      const hasDeclared = state.blowState.declarations.some(
        (declaration) => declaration.seatId === seatId,
      );
      if (player.isPasser || hasDeclared) {
        return { success: false, error: 'Cannot reveal broken hand now' };
      }

      if (!this.hasRevealableBrokenHand(player)) {
        return { success: false, error: 'Player does not have broken hand' };
      }

      const pendingError = await getBrokenHandRevealPendingError(roomGameState);
      if (pendingError) {
        return { success: false, error: pendingError };
      }

      const handSnapshot = [...player.hand];
      state.pendingBrokenHandReveal = {
        seatId,
        handSnapshot,
        startedAt: Date.now(),
      };
      await roomGameState.saveState();

      return {
        success: true,
        delayMs: 3000,
        followUp: { roomId, seatId, handSnapshot },
      };
    } catch (error) {
      this.logger.error(
        'Unexpected error in RevealBrokenHandUseCase.prepare',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }

  async finalize(followUp: {
    roomId: string;
    seatId: SeatId;
    handSnapshot?: string[];
  }): Promise<RevealBrokenHandCompletion> {
    try {
      const { roomId, seatId } = followUp;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const room = await this.roomService.getRoom(roomId);
      const player = state.players.find((p) => p.seatId === seatId);

      if (!player) {
        return { success: false, error: 'Player not found in game state' };
      }

      if (!this.hasRevealableBrokenHand(player)) {
        return { success: false, error: 'Player does not have broken hand' };
      }

      const pendingReveal = state.pendingBrokenHandReveal;
      if (!pendingReveal || pendingReveal.seatId !== seatId) {
        return { success: false, error: 'Broken hand reveal is not pending' };
      }

      if (
        followUp.handSnapshot &&
        !this.isSameHand(pendingReveal.handSnapshot, followUp.handSnapshot)
      ) {
        return { success: false, error: 'Broken hand request is stale' };
      }

      if (!this.isSameHand(player.hand, pendingReveal.handSnapshot)) {
        state.pendingBrokenHandReveal = null;
        await roomGameState.saveState();
        return { success: false, error: 'Broken hand request is stale' };
      }

      const nextState = roomGameState.getState();
      nextState.pendingBrokenHandReveal = null;

      nextState.playState = {
        currentField: null,
        negriCard: null,
        negriSeatId: null,
        neguri: {},
        fields: [],
        lastWinnerSeatId: null,
        openDeclared: false,
        openDeclarerSeatId: null,
      };

      nextState.blowState.declarations = [];
      nextState.blowState.actionHistory = [];
      nextState.blowState.currentHighestDeclaration = null;
      nextState.blowState.currentTrump = null;
      nextState.blowState.lastPasserSeatId = null;
      nextState.blowState.isRoundCancelled = false;

      // ブロークン / 4ジャックの再配りでは吹き始めが1つ進む。
      // 全員パスの再配り (PassBlowUseCase.handleNoDeclarations) だけは据え置き。
      const firstBlowIndex =
        nextState.players.length > 0
          ? (nextState.blowState.currentBlowIndex + 1) %
            nextState.players.length
          : 0;
      const firstBlowPlayer = nextState.players[firstBlowIndex];

      // 次のラウンドの吹き始め (CompleteFieldUseCase.prepareNextRound) は
      // currentBlowIndex から導かれるので、進めた値を書き戻す必要がある。
      nextState.blowState.currentBlowIndex = firstBlowIndex;
      nextState.blowState.redealCount =
        (nextState.blowState.redealCount ?? 0) + 1;
      setCurrentSeat(nextState, firstBlowPlayer?.seatId ?? null);
      nextState.players.forEach((statePlayer) => {
        statePlayer.isPasser = false;
      });
      nextState.deck = this.cardService.generateDeck();
      roomGameState.dealCards();

      const events: GatewayEvent[] = [];
      if (firstBlowPlayer) {
        events.push({
          scope: 'room',
          roomId,
          event: 'blow-updated',
          payload: {
            declarations: [],
            actionHistory: [],
            currentHighest: null,
            lastPasserSeatId: null,
          },
        });

        const brokenPayload: BrokenPayload = {
          nextSeatId: asSeatId(firstBlowPlayer.seatId),
          players: resolveTransportPlayers(roomGameState, nextState.players, {
            roomPlayers: room?.players,
          }),
          gamePhase: 'blow',
        };

        events.push({
          scope: 'room',
          roomId,
          event: 'broken',
          payload: brokenPayload,
        });
        events.push({
          scope: 'room',
          roomId,
          event: 'update-turn',
          payload: firstBlowPlayer.seatId,
        });
      }

      await this.gameEventLogService?.log({
        roomId,
        actionType: 'broken_hand_revealed',
        actorSeatId: seatId,
        state: nextState,
        actionData: {
          nextSeatId: firstBlowPlayer?.seatId ?? null,
          nextBlowIndex: firstBlowIndex,
          startingHandsBySeatId: Object.fromEntries(
            nextState.players.map((statePlayer) => [
              statePlayer.seatId,
              [...statePlayer.hand],
            ]),
          ),
        },
      });

      await roomGameState.saveState();

      return { success: true, events };
    } catch (error) {
      this.logger.error(
        'Unexpected error in RevealBrokenHandUseCase.finalize',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }

  private isSameHand(currentHand: string[], snapshot: string[]): boolean {
    if (currentHand.length !== snapshot.length) {
      return false;
    }

    return currentHand.every((card, index) => card === snapshot[index]);
  }

  private hasRevealableBrokenHand(player: {
    hasBroken?: boolean;
    hasRequiredBroken?: boolean;
  }): boolean {
    return Boolean(player.hasBroken || player.hasRequiredBroken);
  }
}
