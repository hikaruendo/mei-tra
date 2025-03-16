import { Injectable } from '@nestjs/common';
import { Field, TrumpType } from '../types/game.types';

@Injectable()
export class CardService {
  private readonly CARD_STRENGTHS: Record<string, number> = {
    JOKER: 14,
    A: 13,
    K: 12,
    Q: 11,
    J: 10,
    '10': 9,
    '9': 8,
    '8': 7,
    '7': 6,
    '6': 5,
    '5': 4,
  };

  private readonly TRUMP_STRENGTHS: Record<TrumpType, number> = {
    tra: 5,
    hel: 4,
    daya: 3,
    club: 2,
    zuppe: 1,
  };

  generateDeck(): string[] {
    const suits = ['♠', '♣', '♥', '♦'];
    const values = ['5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: string[] = [];

    suits.forEach((suit) =>
      values.forEach((value) => deck.push(`${value}${suit}`)),
    );
    deck.push('JOKER');

    return this.shuffleDeck(deck);
  }

  shuffleDeck(deck: string[]): string[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  isValidCardPlay(
    hand: string[],
    card: string,
    field: Field,
    currentTrump: TrumpType | null,
  ): boolean {
    if (field.cards.length === 0) return true;

    const baseCard = field.baseCard;
    const baseSuit = baseCard.replace(/[0-9JQKA]/, '');
    const cardSuit = card.replace(/[0-9JQKA]/, '');
    const cardValue = card.replace(/[♠♣♥♦]/, '');

    // If player has matching suit, they must play it
    const hasMatchingSuit = hand.some(
      (c) => c.replace(/[0-9JQKA]/, '') === baseSuit,
    );
    if (hasMatchingSuit && cardSuit !== baseSuit) return false;

    // If base card is trump and player only has trump cards, they must play trump
    if (
      baseSuit === currentTrump &&
      hand.every((c) => c.replace(/[0-9JQKA]/, '') === currentTrump) &&
      cardSuit !== currentTrump
    ) {
      return false;
    }

    // Tanzen (Joker) can be played anytime
    if (cardValue === 'JOKER') return true;

    return true;
  }

  getCardStrength(
    card: string,
    baseSuit: string,
    trumpSuit: TrumpType | null,
  ): number {
    const suit = card.replace(/[0-9JQKA]/, '');
    const value = card.replace(/[♠♣♥♦]/, '');
    let strength = this.CARD_STRENGTHS[value];

    if (suit === trumpSuit) {
      strength += 100; // Trump cards are stronger
    } else if (suit === baseSuit) {
      strength += 50; // Base suit cards are stronger than non-base suit
    }

    return strength;
  }

  getTrumpStrength(trumpType: TrumpType): number {
    return this.TRUMP_STRENGTHS[trumpType];
  }
}
