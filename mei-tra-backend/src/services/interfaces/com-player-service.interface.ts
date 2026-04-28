import { DomainPlayer, Team } from '../../types/game.types';

export interface IComPlayerService {
  createComPlayer(seatIndex: number, team: Team): DomainPlayer;
  isComPlayer(
    player: DomainPlayer | { isCOM?: boolean; playerId: string },
  ): boolean;
}
