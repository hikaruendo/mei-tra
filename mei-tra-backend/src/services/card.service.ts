import { Injectable } from '@nestjs/common';
import { TrumpType } from '../types/game.types';

@Injectable()
export class CardService {
  private readonly CARD_STRENGTHS: Record<string, number> = {
    JOKER: 150,
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

  private readonly TRUMP_TO_SUIT: Record<TrumpType, string> = {
    tra: '', // traは特殊なので空文字
    hel: '♥', // ハート
    daya: '♦', // ダイヤ
    club: '♣', // クラブ
    zuppe: '♠', // スペード
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

  getCardStrength(
    card: string,
    baseSuit: string,
    trumpType: TrumpType | null,
  ): number {
    if (card === 'JOKER') return this.CARD_STRENGTHS.JOKER;

    // Get the card's value and suit
    const value = card.startsWith('10') ? '10' : card[0];
    const suit = card.startsWith('10')
      ? card.slice(2)
      : this.getCardSuit(card, trumpType);

    // Base strength from the card's value
    let strength = this.CARD_STRENGTHS[value] || 0;

    // Jの強さを特別に処理（tra の場合は除く）
    if (value === 'J' && trumpType && trumpType !== 'tra') {
      if (this.isPrimaryJack(card, trumpType)) {
        strength = 19; // 正J
      } else if (this.isSecondaryJack(card, trumpType)) {
        strength = 18; // 副J
      }
    }

    // If no trump is set or trump is tra, only match base suit
    if (!trumpType || trumpType === 'tra') {
      if (suit === baseSuit) {
        strength += 50; // Base suit bonus
      }
      return strength;
    }

    // Get the trump suit for the current trump type
    const trumpSuit = this.TRUMP_TO_SUIT[trumpType];

    // Add trump bonus if the card's suit matches the trump suit
    if (suit === trumpSuit) {
      strength += 100; // Trump suit bonus
    }
    // Add base suit bonus if it matches the base suit
    else if (suit === baseSuit) {
      strength += 50; // Base suit bonus
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
        return ''; // In Tra, no primary jack
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
        return ''; // In Tra, no secondary jack
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

  getCardSuit(
    card: string,
    trumpType?: TrumpType | null,
    baseSuit?: string,
  ): string {
    if (card === 'JOKER') {
      // traの場合は、baseSuitが設定されていればそれを使用
      if (trumpType === 'tra' && baseSuit) {
        return baseSuit;
      }
      return baseSuit || '';
    }

    // Handle 10 case
    if (card.startsWith('10')) {
      return card.slice(2);
    }

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
