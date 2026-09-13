import { Inject, Injectable } from '@nestjs/common';
import type { GameOverPayload, OpenDeclaredPayload, RoundResultsPayload } from '@contracts/game';
import { asSeatId } from '../types/identity.types';
import type { GameState, Team } from '../types/game.types';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { OpenDeclarationService } from '../services/open-declaration.service';
import { IChomboService } from '../services/interfaces/chombo-service.interface';
import { IScoreService } from '../services/interfaces/score-service.interface';
import { resolvePlayerByActorId } from './helpers/player-resolution.helper';
import { DeclareOpenRequest, DeclareOpenResponse, IDeclareOpenUseCase } from './interfaces/declare-open.use-case.interface';
import type { GatewayEvent } from './interfaces/gateway-event.interface';

@Injectable()
export class DeclareOpenUseCase implements IDeclareOpenUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    private readonly openDeclarationService: OpenDeclarationService,
    @Inject('IChomboService') private readonly chomboService: IChomboService,
    @Inject('IScoreService') private readonly scoreService: IScoreService,
  ) {}

  async execute(request: DeclareOpenRequest): Promise<DeclareOpenResponse> {
    const room = await this.roomService.getRoom(request.roomId);
    if (room?.settings.gameMode !== 'pro') return { success: false, error: 'Open is only available in pro mode' };
    const roomGameState = await this.roomService.getRoomGameState(request.roomId);
    const state = roomGameState.getState();
    if (state.gamePhase !== 'play' || !state.playState) return { success: false, error: 'Open is only available during play' };
    const player = resolvePlayerByActorId(roomGameState, request.actorId);
    if (!player || player.isCOM) return { success: false, error: 'Player not found in game state' };
    const winnerSeatId = state.blowState.currentHighestDeclaration?.seatId;
    if (!winnerSeatId || winnerSeatId !== player.seatId) return { success: false, error: 'Only the declaration winner may open' };
    if (state.playState.openDeclared) return { success: false, error: 'Open has already been declared' };

    const valid = this.openDeclarationService.canDeclareOpen(state, asSeatId(player.seatId));
    state.playState.openDeclared = true;
    state.playState.openDeclarerSeatId = asSeatId(player.seatId);
    state.playState.revealedHands = { ...(state.playState.revealedHands ?? {}), [player.seatId]: [...player.hand] };
    if (!valid) {
      const violation = this.chomboService.recordViolation(asSeatId(player.seatId), 'wrong-open');
      state.playState.chomboViolations = [...(state.playState.chomboViolations ?? []), violation];
    }

    const payload: OpenDeclaredPayload = { declarerSeatId: asSeatId(player.seatId), hand: [...player.hand], valid };
    const events: GatewayEvent[] = [{ scope: 'room', roomId: request.roomId, event: 'open-declared', payload }];
    if (valid) events.push(...this.settleValidOpen(state, request.roomId));
    await roomGameState.saveState();
    return { success: true, events };
  }

  private settleValidOpen(state: GameState, roomId: string) {
    const playState = state.playState;
    const declarerTeam = state.players.find((candidate) => candidate.seatId === playState?.openDeclarerSeatId)?.team;
    if (declarerTeam === undefined || !playState) return [];
    const currentFieldTrick = playState.currentField?.cards.length ? 1 : 0;
    const remainingTricks = Math.max(...state.players.map((candidate) => candidate.hand.length)) + currentFieldTrick;
    const wonFields = playState.fields.length + remainingTricks;
    const declaredPairs = state.blowState.currentHighestDeclaration?.numberOfPairs ?? 0;
    const points = this.scoreService.calculatePlayPoints(declaredPairs, wonFields);
    const awardedTeam: Team = points >= 0 ? declarerTeam : (1 - declarerTeam) as Team;
    const awardedPoints = Math.abs(points);
    state.teamScores[awardedTeam].play += awardedPoints;
    state.teamScores[awardedTeam].total += awardedPoints;
    const events: Array<{ scope: 'room'; roomId: string; event: string; payload: unknown }> = [
      { scope: 'room', roomId, event: 'round-results', payload: { scores: state.teamScores } satisfies RoundResultsPayload },
    ];
    if (state.teamScores[awardedTeam].total >= state.pointsToWin) {
      events.push({ scope: 'room', roomId, event: 'game-over', payload: { winner: `Team ${awardedTeam}`, winningTeam: awardedTeam, finalScores: state.teamScores } satisfies GameOverPayload });
    }
    return events;
  }
}
