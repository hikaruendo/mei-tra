import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ChomboResolvedPayload } from '@contracts/game';
import { asSeatId } from '../types/identity.types';
import { IRoomService } from '../services/interfaces/room-service.interface';
import {
  IReportChomboUseCase,
  ReportChomboRequest,
  ReportChomboResponse,
} from './interfaces/report-chombo.use-case.interface';
import { resolvePlayerByActorId } from './helpers/player-resolution.helper';
import { completeRoundAfterChombo } from './helpers/round-completion.helper';
import type { IChomboService } from '../services/interfaces/chombo-service.interface';
import type { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import type { IScoreService } from '../services/interfaces/score-service.interface';

@Injectable()
export class ReportChomboUseCase implements IReportChomboUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IChomboService') private readonly chomboService: IChomboService,
    @Inject('IScoreService') private readonly scoreService: IScoreService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
  ) {}

  async execute(request: ReportChomboRequest): Promise<ReportChomboResponse> {
    const room = await this.roomService.getRoom(request.roomId);
    if (room?.settings.gameMode !== 'pro') {
      return {
        success: false,
        error: 'Chombo reports are only available in pro mode',
      };
    }

    const roomGameState = await this.roomService.getRoomGameState(
      request.roomId,
    );
    const state = roomGameState.getState();
    if (state.gamePhase !== 'play' || !state.playState || state.gameOver) {
      return {
        success: false,
        error: 'Chombo reports are only available during play',
      };
    }
    if (state.playState.chomboRoundNumber !== state.roundNumber) {
      return { success: false, error: 'Chombo reporting window has ended' };
    }

    const reporter = resolvePlayerByActorId(roomGameState, request.actorId);
    const violator = state.players.find(
      (player) => player.seatId === request.violatorSeatId,
    );
    if (!reporter || !violator) {
      return { success: false, error: 'Player not found in game state' };
    }
    if (reporter.isCOM) {
      return { success: false, error: 'COM cannot report chombos' };
    }
    if (reporter.team === violator.team) {
      return { success: false, error: 'You can only report the opposing team' };
    }

    const persistedViolation = this.chomboService.resolveReport(
      state.playState.chomboViolations ?? [],
      asSeatId(reporter.seatId),
      asSeatId(violator.seatId),
      request.violationType,
    );
    const isCorrect = Boolean(persistedViolation);
    const awardedTeam = isCorrect ? reporter.team : violator.team;
    this.scoreService.addPoints(
      awardedTeam,
      5,
      state.teamScores,
      state.teamScoreRecords,
      'Chombo points',
    );

    await this.gameEventLogService?.log({
      roomId: request.roomId,
      actionType: 'chombo_reported',
      actorSeatId: asSeatId(reporter.seatId),
      state,
      actionData: {
        violatorSeatId: violator.seatId,
        violationType: request.violationType,
        isCorrect,
        awardedTeam,
      },
    });

    const payload: ChomboResolvedPayload = {
      violatorSeatId: asSeatId(violator.seatId),
      reporterSeatId: asSeatId(reporter.seatId),
      violationType: request.violationType,
      isCorrect,
      awardedTeam,
      scores: state.teamScores,
    };
    // Every report scores for one of the teams, so the round ends with it.
    const completion = await completeRoundAfterChombo({
      roomId: request.roomId,
      roomGameState,
      state,
      room,
      roomService: this.roomService,
      gameEventLogService: this.gameEventLogService,
    });

    return {
      success: true,
      events: [
        {
          scope: 'room',
          roomId: request.roomId,
          event: 'chombo-resolved',
          payload,
        },
        ...completion.events,
      ],
      delayedEvents: completion.delayedEvents,
      gameOver: completion.gameOver,
      roundStoppedEarly: true,
    };
  }
}
