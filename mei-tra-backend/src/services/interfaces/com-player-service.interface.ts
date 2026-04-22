import { DomainPlayer, Team, Field, TrumpType } from '../../types/game.types';

export interface IComPlayerService {
  createComPlayer(seatIndex: number, team: Team): DomainPlayer;
  selectBestCard(
    hand: string[],
    field: Field | null,
    trump: TrumpType | null,
  ): string;
  selectBaseSuit(hand: string[], trump: TrumpType | null): string;
  isComPlayer(
    player: DomainPlayer | { isCOM?: boolean; playerId: string },
  ): boolean;
}
