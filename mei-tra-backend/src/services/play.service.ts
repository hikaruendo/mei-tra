import { Injectable } from '@nestjs/common';
import { DomainPlayer, Field, TrumpType } from '../types/game.types';
import { CardService } from './card.service';
import { IPlayService } from './interfaces/play-service.interface';

@Injectable()
export class PlayService implements IPlayService {
  private readonly trumpToSuit: Record<TrumpType, string> = {
    tra: '',
    herz: '♥',
    daiya: '♦',
    club: '♣',
    zuppe: '♠',
  };

  constructor(private readonly cardService: CardService) {}

  determineFieldWinner(
    field: Field,
    players: DomainPlayer[],
    trumpSuit: TrumpType | null,
  ): DomainPlayer | null {
    if (players.length === 0) {
      return null;
    }

    const baseCard = field.baseCard;
    const baseSuit = this.cardService.getCardSuit(
      baseCard,
      trumpSuit,
      field.baseSuit,
    );

    let winner: DomainPlayer | null = null;
    let highestStrength = -1;

    // ディーラーのインデックスを取得
    let dealerIndex = players.findIndex((p) => p.playerId === field.dealerId);

    // ディーラーが見つからない場合、最初の有効なプレイヤーをディーラーとする
    if (dealerIndex === -1) {
      dealerIndex = 0;
      field.dealerId = players[0].playerId;
    }

    // field.cards is stored in actual play order, so winner attribution must use
    // the full seat order, including COM players.
    const updatedPlayerOrder = field.cards.map((_, i) => {
      const index = (dealerIndex + i) % players.length;
      return players[index];
    });

    // 各カードの強度を計算して勝者を決定
    field.cards.forEach((card, cardIndex) => {
      const player = updatedPlayerOrder[cardIndex];
      if (!player) {
        return;
      }

      const strength = this.cardService.getCardStrength(
        card,
        baseSuit,
        trumpSuit,
      );

      if (strength > highestStrength) {
        highestStrength = strength;
        winner = player;
      }
    });

    return winner;
  }

  getLegalPlayCards(
    hand: string[],
    field: Field | null,
    trump: TrumpType | null,
  ): string[] {
    if (hand.length === 0) {
      return [];
    }

    if (hand.length === 2 && hand.includes('JOKER')) {
      return ['JOKER'];
    }

    if (!field || field.cards.length === 0 || !field.baseCard) {
      return [...hand];
    }

    const baseSuit = this.resolveFieldBaseSuit(field, trump);
    if (!baseSuit) {
      return [...hand];
    }

    const suitCards = hand.filter(
      (card) =>
        card !== 'JOKER' &&
        this.cardService.getCardSuit(card, trump, baseSuit) === baseSuit,
    );
    const jokerCards = hand.filter((card) => card === 'JOKER');

    if (suitCards.length > 0) {
      return [...suitCards, ...jokerCards];
    }

    const trumpSuit = trump ? this.trumpToSuit[trump] : '';
    const hasJoker = hand.includes('JOKER');
    const hasTrumpSuit = trumpSuit
      ? hand.some(
          (card) =>
            card !== 'JOKER' &&
            this.cardService.getCardSuit(card, trump, baseSuit) === trumpSuit,
        )
      : false;

    if (hasJoker && baseSuit === trumpSuit && !hasTrumpSuit) {
      return ['JOKER'];
    }

    return [...hand];
  }

  getCardPlayError(
    hand: string[],
    field: Field,
    trump: TrumpType | null,
    card: string,
  ): string | null {
    if (hand.length === 2 && hand.includes('JOKER') && card !== 'JOKER') {
      return 'In Tanzen round, you must play the Joker if you have it.';
    }

    const legalCards = this.getLegalPlayCards(hand, field, trump);
    if (legalCards.includes(card)) {
      return null;
    }

    const baseSuit = this.resolveFieldBaseSuit(field, trump);
    const trumpSuit = trump ? this.trumpToSuit[trump] : '';

    if (baseSuit && baseSuit === trumpSuit && hand.includes('JOKER')) {
      return `You must play the Joker since you have no ${trumpSuit} cards.`;
    }

    return baseSuit ? `You must play a card of suit ${baseSuit}.` : null;
  }

  private resolveFieldBaseSuit(field: Field, trump: TrumpType | null): string {
    if (field.baseCard === 'JOKER') {
      return field.baseSuit ?? '';
    }

    return this.cardService.getCardSuit(field.baseCard, trump, field.baseSuit);
  }
}
