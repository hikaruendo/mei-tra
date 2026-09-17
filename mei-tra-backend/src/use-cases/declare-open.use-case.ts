import { Inject, Injectable, Optional } from '@nestjs/common';
import { OPEN_MAX_HAND_SIZE } from '@contracts/game';
import type { OpenDeclaredPayload } from '@contracts/game';
import type { DomainPlayer, Team } from '../types/game.types';
import { asSeatId } from '../types/identity.types';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { OpenDeclarationService } from '../services/open-declaration.service';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { IScoreService } from '../services/interfaces/score-service.interface';
import { resolvePlayerByActorId } from './helpers/player-resolution.helper';
import {
  completeRound,
  completeRoundAfterChombo,
} from './helpers/round-completion.helper';
import {
  DeclareOpenRequest,
  DeclareOpenResponse,
  IDeclareOpenUseCase,
} from './interfaces/declare-open.use-case.interface';
import type { GatewayEvent } from './interfaces/gateway-event.interface';

/** What a failed open gives the other team, the same as a chombo. */
const FAILED_OPEN_POINTS = 5;

@Injectable()
export class DeclareOpenUseCase implements IDeclareOpenUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    private readonly openDeclarationService: OpenDeclarationService,
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
    if (state.playState.openResolved) {
      return { success: false, error: 'Open has already been declared' };
    }
    if (player.hand.length > OPEN_MAX_HAND_SIZE) {
      return {
        success: false,
        error: 'Open is only available with four or fewer cards in hand',
      };
    }
    // The last field of a round is completed on a delay, so an empty hand
    // still reaches here. There is nothing left to win, and an empty hand
    // reads as "every trick taken", which would end the round and score the
    // field that is still waiting to be completed.
    if (player.hand.length === 0) {
      return {
        success: false,
        error: 'Open is only available while you hold cards',
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

    if (!valid) {
      state.playState.openResolved = true;
      return this.settleFailedOpen(
        { roomId: request.roomId, roomGameState, state, room },
        player,
      );
    }

    const payload: OpenDeclaredPayload = {
      declarerSeatId: asSeatId(player.seatId),
      hand: [...player.hand],
      valid: true,
    };
    const events: GatewayEvent[] = [
      {
        scope: 'room',
        roomId: request.roomId,
        event: 'open-declared',
        payload,
      },
    ];

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
      roundStoppedEarly: true,
    };
  }

  /**
   * A failed open gives the other team 5 points and ends the round the way a
   * chombo report does. It is written to the play log; a valid open is not,
   * since the round it completes is.
   */
  private async settleFailedOpen(
    params: Omit<
      Parameters<typeof completeRoundAfterChombo>[0],
      'roomService' | 'gameEventLogService'
    >,
    player: DomainPlayer,
  ): Promise<DeclareOpenResponse> {
    const { roomId, state } = params;
    const awardedTeam = (1 - player.team) as Team;
    const hand = [...player.hand];
    this.scoreService.addPoints(
      awardedTeam,
      FAILED_OPEN_POINTS,
      state.teamScores,
      state.teamScoreRecords,
      'Failed open points',
    );

    // Logged before the round completes, so the log reads in play order.
    await this.gameEventLogService?.log({
      roomId,
      actionType: 'open_failed',
      actorSeatId: asSeatId(player.seatId),
      state,
      actionData: { hand, awardedTeam },
    });

    const payload: OpenDeclaredPayload = {
      declarerSeatId: asSeatId(player.seatId),
      hand,
      valid: false,
      awardedTeam,
    };
    const completion = await completeRoundAfterChombo({
      ...params,
      roomService: this.roomService,
      gameEventLogService: this.gameEventLogService,
    });

    return {
      success: true,
      events: [
        { scope: 'room', roomId, event: 'open-declared', payload },
        ...completion.events,
      ],
      delayedEvents: completion.delayedEvents,
      gameOver: completion.gameOver,
      roundStoppedEarly: true,
    };
  }
}
