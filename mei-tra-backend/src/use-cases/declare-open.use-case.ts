import { Inject, Injectable } from '@nestjs/common';
import type { OpenDeclaredPayload } from '@contracts/game';
import { asSeatId } from '../types/identity.types';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { OpenDeclarationService } from '../services/open-declaration.service';
import { IChomboService } from '../services/interfaces/chombo-service.interface';
import { resolvePlayerByActorId } from './helpers/player-resolution.helper';
import {
  DeclareOpenRequest,
  DeclareOpenResponse,
  IDeclareOpenUseCase,
} from './interfaces/declare-open.use-case.interface';

@Injectable()
export class DeclareOpenUseCase implements IDeclareOpenUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    private readonly openDeclarationService: OpenDeclarationService,
    @Inject('IChomboService') private readonly chomboService: IChomboService,
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

    const winnerSeatId = state.blowState.currentHighestDeclaration?.seatId;
    if (!winnerSeatId || winnerSeatId !== player.seatId) {
      return { success: false, error: 'Only the declaration winner may open' };
    }
    if (state.playState.openDeclared) {
      return { success: false, error: 'Open has already been declared' };
    }

    const valid = this.openDeclarationService.canDeclareOpen(
      state,
      asSeatId(player.seatId),
    );
    state.playState.openDeclared = true;
    state.playState.openDeclarerSeatId = asSeatId(player.seatId);

    if (!valid) {
      const violation = this.chomboService.recordViolation(
        asSeatId(player.seatId),
        'wrong-open',
      );
      state.playState.chomboViolations = [
        ...(state.playState.chomboViolations ?? []),
        violation,
      ];
    }

    await roomGameState.saveState();
    const payload: OpenDeclaredPayload = {
      declarerSeatId: asSeatId(player.seatId),
      hand: [...player.hand],
      valid,
    };
    return {
      success: true,
      events: [
        {
          scope: 'room',
          roomId: request.roomId,
          event: 'open-declared',
          payload,
        },
      ],
    };
  }
}
