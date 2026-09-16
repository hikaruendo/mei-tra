import { Inject, Injectable, Optional } from '@nestjs/common';
import { OPEN_MAX_HAND_SIZE } from '@contracts/game';
import type { OpenDeclaredPayload } from '@contracts/game';
import { asSeatId } from '../types/identity.types';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { OpenDeclarationService } from '../services/open-declaration.service';
import { IChomboService } from '../services/interfaces/chombo-service.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { IScoreService } from '../services/interfaces/score-service.interface';
import { resolvePlayerByActorId } from './helpers/player-resolution.helper';
import { completeRound } from './helpers/round-completion.helper';
import {
  DeclareOpenRequest,
  DeclareOpenResponse,
  IDeclareOpenUseCase,
} from './interfaces/declare-open.use-case.interface';
import type { GatewayEvent } from './interfaces/gateway-event.interface';

@Injectable()
export class DeclareOpenUseCase implements IDeclareOpenUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    private readonly openDeclarationService: OpenDeclarationService,
    @Inject('IChomboService') private readonly chomboService: IChomboService,
    @Inject('IScoreService') private readonly scoreService: IScoreService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
  ) {}

  async execute(request: DeclareOpenRequest): Promise<DeclareOpenResponse> {
    const room = await this.roomService.getRoom(request.roomId);
    if (room?.settings.gameMode !== 'pro') {
      return { success: false, error: 'Open is only available in pro mode' };
    }
    const roomGameState = await this.roomService.getRoomGameState(
      request.roomId,
    );
    const state = roomGameState.getState();
    if (state.gamePhase !== 'play' || !state.playState) {
      return { success: false, error: 'Open is only available during play' };
    }
    const player = resolvePlayerByActorId(roomGameState, request.actorId);
    if (!player || player.isCOM) {
      return { success: false, error: 'Player not found in game state' };
    }
    if (!state.blowState.currentHighestDeclaration) {
      return { success: false, error: 'Open requires a completed declaration' };
    }
    if (state.playState.openDeclared) {
      return { success: false, error: 'Open has already been declared' };
    }
    if (player.hand.length > OPEN_MAX_HAND_SIZE) {
      return {
        success: false,
        error: `Open is only available with ${OPEN_MAX_HAND_SIZE} or fewer cards in hand`,
      };
    }

    const valid = this.openDeclarationService.canDeclareOpen(
      state,
      asSeatId(player.seatId),
    );
    state.playState.openDeclared = true;
    state.playState.openDeclarerSeatId = asSeatId(player.seatId);
    state.playState.revealedHands = {
      ...(state.playState.revealedHands ?? {}),
      [player.seatId]: [...player.hand],
    };

    const payload: OpenDeclaredPayload = {
      declarerSeatId: asSeatId(player.seatId),
      hand: [...player.hand],
      valid,
    };
    const events: GatewayEvent[] = [
      {
        scope: 'room',
        roomId: request.roomId,
        event: 'open-declared',
        payload,
      },
    ];

    if (!valid) {
      const violation = this.chomboService.recordViolation(
        asSeatId(player.seatId),
        'wrong-open',
      );
      state.playState.chomboViolations = [
        ...(state.playState.chomboViolations ?? []),
        violation,
      ];
      await roomGameState.saveState();
      return { success: true, events };
    }

    state.playState.openResolved = true;
    const completion = await completeRound({
      roomId: request.roomId,
      roomGameState,
      state,
      room,
      roomService: this.roomService,
      scoreService: this.scoreService,
      gameEventLogService: this.gameEventLogService,
      remainingFieldsWinnerTeam: player.team,
    });
    if (!completion) {
      return {
        success: false,
        error: 'Declaring team could not be determined',
      };
    }

    return {
      success: true,
      events: [...events, ...completion.events],
      delayedEvents: completion.delayedEvents,
      gameOver: completion.gameOver,
    };
  }
}
