import { Injectable } from '@nestjs/common';
import { DomainPlayer, Team } from '../types/game.types';
import { IComPlayerService } from './interfaces/com-player-service.interface';
import { asSeatId } from '../types/identity.types';

@Injectable()
export class ComPlayerService implements IComPlayerService {
  createComPlayer(seatIndex: number, team: Team): DomainPlayer {
    return {
      seatId: asSeatId(`com-${seatIndex}`),
      name: `COM ${seatIndex + 1}`,
      hand: [],
      team,
      isPasser: false,
      isCOM: true,
      hasBroken: false,
      hasRequiredBroken: false,
    };
  }

  isComPlayer(
    player: DomainPlayer | { isCOM?: boolean; seatId: string },
  ): boolean {
    return player.isCOM === true || player.seatId.startsWith('com-');
  }
}
