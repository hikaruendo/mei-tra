import { Injectable } from '@nestjs/common';
import { DomainPlayer, Team } from '../types/game.types';
import { IComPlayerService } from './interfaces/com-player-service.interface';

@Injectable()
export class ComPlayerService implements IComPlayerService {
  createComPlayer(seatIndex: number, team: Team): DomainPlayer {
    return {
      playerId: `com-${seatIndex}`,
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
    player: DomainPlayer | { isCOM?: boolean; playerId: string },
  ): boolean {
    return player.isCOM === true || player.playerId.startsWith('com-');
  }
}
