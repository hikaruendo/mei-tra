import { Inject, Injectable } from '@nestjs/common';
import type { ChomboHandRevealedPayload } from '@contracts/game';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { resolvePlayerByActorId } from './helpers/player-resolution.helper';
import { asSeatId } from '../types/identity.types';
import { IRevealChomboHandUseCase, RevealChomboHandRequest, RevealChomboHandResponse } from './interfaces/reveal-chombo-hand.use-case.interface';

@Injectable()
export class RevealChomboHandUseCase implements IRevealChomboHandUseCase {
  constructor(@Inject('IRoomService') private readonly roomService: IRoomService) {}

  async execute(request: RevealChomboHandRequest): Promise<RevealChomboHandResponse> {
    const room = await this.roomService.getRoom(request.roomId);
    if (room?.settings.gameMode !== 'pro') return { success: false, error: 'Hand reveal is only available in pro mode' };
    const roomGameState = await this.roomService.getRoomGameState(request.roomId);
    const state = roomGameState.getState();
    if (state.gamePhase !== 'play' || !state.playState) return { success: false, error: 'Hand reveal is only available during play' };
    const player = resolvePlayerByActorId(roomGameState, request.actorId);
    if (!player || player.isCOM || player.seatId !== request.seatId) return { success: false, error: 'Only the target player may reveal their hand' };
    const hasCandidate = (state.playState.chomboViolations ?? []).some((violation) => violation.violatorSeatId === player.seatId && !violation.isExpired);
    if (!hasCandidate) return { success: false, error: 'No chombo check requires this hand' };
    state.playState.revealedHands = { ...(state.playState.revealedHands ?? {}), [player.seatId]: [...player.hand] };
    await roomGameState.saveState();
    const payload: ChomboHandRevealedPayload = { seatId: asSeatId(player.seatId), hand: [...player.hand] };
    return { success: true, events: [{ scope: 'room', roomId: request.roomId, event: 'chombo-hand-revealed', payload }] };
  }
}
