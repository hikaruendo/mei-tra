import { Field, Player, TrumpType } from '../../types/game.types';

export interface IPlayService {
  determineFieldWinner(
    field: Field,
    players: Player[],
    trumpSuit: TrumpType | null,
  ): Player | null;
}
