import { Injectable } from '@nestjs/common';
import { Field, TrumpType } from '../types/game.types';

@Injectable()
export class CardService {
  private readonly CARD_STRENGTHS: Record<string, number> = {
    JOKER: 100,
    A: 14,
    K: 13,
    Q: 12,
    J: 11,
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
    // If baseCard is a secondary Jack, use the primary Jack's suit as baseSuit
    const baseSuit = this.isSecondaryJack(baseCard, currentTrump as TrumpType)
      ? this.getPrimaryJack(currentTrump as TrumpType).replace(/[0-9JQKA]/, '')
      : baseCard.replace(/[0-9JQKA]/, '');
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

    // Jの強さを特別に処理（tra の場合は除く）
    if (value === 'J' && trumpSuit && trumpSuit !== 'tra') {
      if (this.isPrimaryJack(card, trumpSuit)) {
        strength = 19; // 正J
      } else if (this.isSecondaryJack(card, trumpSuit)) {
        strength = 18; // 副J
      }
    }

    // Add bonus strength for trump suit cards
    if (suit === trumpSuit) {
      strength += 50;
    }

    console.log(
      'baseSuit:',
      baseSuit,
      'trumpSuit:',
      trumpSuit,
      'suit:',
      suit,
      'value:',
      value,
      'strength:',
      strength,
    );
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

  getCardSuit(card: string, trumpType?: TrumpType | null): string {
    if (card === 'JOKER') return trumpType || '';

    // If it's a Jack and trumpType is provided, check if it's a secondary Jack
    if (card.startsWith('J') && trumpType) {
      if (this.isSecondaryJack(card, trumpType)) {
        // For secondary Jack, return the primary Jack's suit
        return this.getPrimaryJack(trumpType).replace(/[0-9JQKA]/, '');
      }
    }

    return card.slice(-1);
  }
}
