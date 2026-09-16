import { findActiveChomboCandidate } from '../domain/chombo-candidates';
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
import { ChomboService } from '../services/chombo.service';
import type { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import type { IScoreService } from '../services/interfaces/score-service.interface';

@Injectable()
export class ReportChomboUseCase implements IReportChomboUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Optional() private readonly chomboService?: ChomboService,
    @Optional() @Inject('IScoreService') private readonly scoreService?: IScoreService,
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

    const persistedViolation = this.chomboService?.resolveReport(
      state.playState.chomboViolations ?? [],
      asSeatId(reporter.seatId),
      asSeatId(violator.seatId),
      request.violationType,
    ) ?? findActiveChomboCandidate(state.playState.chomboViolations ?? [], asSeatId(violator.seatId), request.violationType);
    if (persistedViolation && !persistedViolation.reportedBySeatId) persistedViolation.reportedBySeatId = asSeatId(reporter.seatId);
    const isCorrect = Boolean(persistedViolation);
    const awardedTeam = isCorrect ? reporter.team : violator.team;
    if (this.scoreService) {
      this.scoreService.addPoints(awardedTeam, 5, state.teamScores);
    } else {
      state.teamScores[awardedTeam].play += 5;
      state.teamScores[awardedTeam].total += 5;
    }
    state.playState.chomboReports = [
      ...(state.playState.chomboReports ?? []),
      {
        violatorSeatId: asSeatId(violator.seatId),
        violationType: request.violationType,
        reporterSeatId: asSeatId(reporter.seatId),
        resolved: true,
        awardedTeam,
        timestamp: Date.now(),
      },
    ];

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
    };
  }
}
