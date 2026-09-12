import { Inject, Injectable } from '@nestjs/common';
import type { ChomboResolvedPayload, GameOverPayload } from '@contracts/game';
import { asSeatId } from '../types/identity.types';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IChomboService } from '../services/interfaces/chombo-service.interface';
import {
  IReportChomboUseCase,
  ReportChomboRequest,
  ReportChomboResponse,
} from './interfaces/report-chombo.use-case.interface';
import type { GatewayEvent } from './interfaces/gateway-event.interface';
import { resolvePlayerByActorId } from './helpers/player-resolution.helper';
import { RoomStatus } from '../types/room.types';

@Injectable()
export class ReportChomboUseCase implements IReportChomboUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IChomboService') private readonly chomboService: IChomboService,
  ) {}

  async execute(request: ReportChomboRequest): Promise<ReportChomboResponse> {
    const room = await this.roomService.getRoom(request.roomId);
    if (room?.settings.gameMode !== 'pro') {
      return { success: false, error: 'Chombo reports are only available in pro mode' };
    }

    const roomGameState = await this.roomService.getRoomGameState(request.roomId);
    const state = roomGameState.getState();
    if (state.gamePhase !== 'play' || !state.playState) {
      return { success: false, error: 'Chombo reports are only available during play' };
    }

    const reporter = resolvePlayerByActorId(roomGameState, request.actorId);
    const violator = state.players.find((player) => player.seatId === request.violatorSeatId);
    if (!reporter || !violator) {
      return { success: false, error: 'Player not found in game state' };
    }
    if (reporter.isCOM) {
      return { success: false, error: 'COM cannot report chombos' };
    }
    if (reporter.team === violator.team) {
      return { success: false, error: 'You can only report the opposing team' };
    }

    const reports = state.playState.chomboReports ?? [];
    if (reports.some((report) =>
      report.violatorSeatId === violator.seatId &&
      report.violationType === request.violationType,
    )) {
      return { success: false, error: 'This chombo has already been reported' };
    }

    const violation = this.chomboService.reportViolation(
      asSeatId(reporter.seatId),
      asSeatId(violator.seatId),
      request.violationType,
      reporter.team,
      violator.team,
    );
    const isCorrect = Boolean(violation);
    const awardedTeam = isCorrect ? reporter.team : violator.team;
    state.teamScores[awardedTeam].play += 5;
    state.teamScores[awardedTeam].total += 5;
    state.playState.chomboReports = [
      ...reports,
      {
        violatorSeatId: asSeatId(violator.seatId),
        violationType: request.violationType,
        reporterSeatId: asSeatId(reporter.seatId),
        resolved: true,
        awardedTeam,
        timestamp: Date.now(),
      },
    ];
    await roomGameState.saveState();

    const payload: ChomboResolvedPayload = {
      violatorSeatId: asSeatId(violator.seatId),
      reporterSeatId: asSeatId(reporter.seatId),
      violationType: request.violationType,
      isCorrect,
      awardedTeam,
      scores: state.teamScores,
    };
    const events: GatewayEvent[] = [
      { scope: 'room', roomId: request.roomId, event: 'chombo-resolved', payload },
    ];
    const pointsToWin = state.pointsToWin;
    if (state.teamScores[awardedTeam].total >= pointsToWin) {
      const gameOverPayload: GameOverPayload = {
        winner: `Team ${awardedTeam}`,
        winningTeam: awardedTeam,
        finalScores: state.teamScores,
      };
      await this.roomService.updateRoomStatus(request.roomId, RoomStatus.FINISHED);
      events.push({
        scope: 'room',
        roomId: request.roomId,
        event: 'game-over',
        payload: gameOverPayload,
      });
    }

    return {
      success: true,
      events,
    };
  }
}
