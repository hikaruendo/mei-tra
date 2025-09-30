import { TrumpType } from '../../types/game.types';

export interface ICardService {
  generateDeck(): string[];
  compareCards(cardA: string, cardB: string): number;
  generateScoringCards(): string[];
  getCardStrength(
    card: string,
    baseSuit: string,
    trumpType: TrumpType | null,
  ): number;
  getCardSuit(
    card: string,
    trumpType?: TrumpType | null,
    baseSuit?: string,
  ): string;
}
