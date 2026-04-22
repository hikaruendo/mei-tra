import { DomainPlayer, Field, TrumpType } from '../../types/game.types';

export interface IPlayService {
  determineFieldWinner(
    field: Field,
    players: DomainPlayer[],
    trumpSuit: TrumpType | null,
  ): DomainPlayer | null;
}
