import { Player, Team, Field, TrumpType } from '../../types/game.types';

export interface IComPlayerService {
  createComPlayer(seatIndex: number, team: Team): Player;
  selectBestCard(
    hand: string[],
    field: Field | null,
    trump: TrumpType | null,
  ): string;
  isComPlayer(player: Player | { isCOM?: boolean; playerId: string }): boolean;
}
