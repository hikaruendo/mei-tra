import { Injectable } from '@nestjs/common';
import { Field, TrumpType } from '../types/game.types';

@Injectable()
export class CardService {
  private readonly CARD_STRENGTHS: Record<string, number> = {
    JOKER: 20,
    A: 13,
    K: 12,
    Q: 11,
    '10': 10,
    '9': 9,
    '8': 8,
    '7': 7,
    '6': 6,
    '5': 5,
  };

  private readonly TRUMP_STRENGTHS: Record<TrumpType, number> = {
    tra: 5,
    hel: 4,
    daya: 3,
    club: 2,
    zuppe: 1,
  };

  private readonly suits = ['♠', '♣', '♥', '♦'];
  private readonly values = [
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'J',
    'Q',
    'K',
    'A',
  ];

  generateDeck(): string[] {
    const deck: string[] = [];

    for (const suit of this.suits) {
      for (const value of this.values.slice(3)) {
        // Skip 2,3,4
        deck.push(`${value}${suit}`);
      }
    }

    // Add Joker
    deck.push('JOKER');

    return this.shuffleDeck(deck);
  }

  generateScoringCards(): string[] {
    const deck: string[] = [];

    for (const suit of this.suits) {
      for (const value of this.values.slice(0, 3)) {
        // Only 2,3,4
        deck.push(`${value}${suit}`);
      }
    }

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

    // Jの強さを特別に処理（とらの場合は除く）
    if (value === 'J' && trumpSuit && trumpSuit !== 'tra') {
      if (this.isPrimaryJack(card, trumpSuit)) {
        strength = 19; // 正J
      } else if (this.isSecondaryJack(card, trumpSuit)) {
        strength = 18; // 副J
      }
    }

    // とらの場合はスートによる強さの加算なし
    if (trumpSuit !== 'tra') {
      if (suit === trumpSuit) {
        strength += 100; // Trump cards are stronger
      } else if (suit === baseSuit) {
        strength += 50; // Base suit cards are stronger than non-base suit
      }
    }

    return strength;
  }

  getTrumpStrength(trumpType: TrumpType): number {
    return this.TRUMP_STRENGTHS[trumpType];
  }

  // TODO: tra の時はJは普通のカードになる
  getPrimaryJack(trumpType: TrumpType): string {
    switch (trumpType) {
      case 'hel':
        return 'J♥';
      case 'daya':
        return 'J♦';
      case 'club':
        return 'J♣';
      case 'zuppe':
        return 'J♠';
      case 'tra':
        return 'J♥'; // In Tra, Hearts Jack is primary
      default:
        return 'J♥';
    }
  }

  getSecondaryJack(trumpType: TrumpType): string {
    switch (trumpType) {
      case 'hel':
        return 'J♦';
      case 'daya':
        return 'J♥';
      case 'club':
        return 'J♠';
      case 'zuppe':
        return 'J♣';
      case 'tra':
        return 'J♦'; // In Tra, Diamonds Jack is secondary
      default:
        return 'J♦';
    }
  }

  isJack(card: string): boolean {
    return card.startsWith('J');
  }

  isPrimaryJack(card: string, trumpType: TrumpType): boolean {
    return card === this.getPrimaryJack(trumpType);
  }

  isSecondaryJack(card: string, trumpType: TrumpType): boolean {
    return card === this.getSecondaryJack(trumpType);
  }

  getCardValue(card: string): number {
    if (card === 'JOKER') return 20;
    const value = card.slice(0, -1);
    switch (value) {
      case 'J':
        return 11;
      case 'Q':
        return 11;
      case 'K':
        return 12;
      case 'A':
        return 13;
      default:
        return parseInt(value, 10);
    }
  }

  getCardSuit(card: string): string {
    if (card === 'JOKER') return '';
    return card.slice(-1);
  }
}
