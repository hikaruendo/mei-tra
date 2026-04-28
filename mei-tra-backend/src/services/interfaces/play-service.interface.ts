import { DomainPlayer, Field, TrumpType } from '../../types/game.types';

export interface IPlayService {
  determineFieldWinner(
    field: Field,
    players: DomainPlayer[],
    trumpSuit: TrumpType | null,
  ): DomainPlayer | null;

  getLegalPlayCards(
    hand: string[],
    field: Field | null,
    trump: TrumpType | null,
  ): string[];

  getCardPlayError(
    hand: string[],
    field: Field,
    trump: TrumpType | null,
    card: string,
  ): string | null;
}
