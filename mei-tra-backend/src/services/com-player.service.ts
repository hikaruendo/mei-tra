import { Injectable, Inject } from '@nestjs/common';
import { Player, Team, Field, TrumpType } from '../types/game.types';
import { ICardService } from './interfaces/card-service.interface';
import { IComPlayerService } from './interfaces/com-player-service.interface';

@Injectable()
export class ComPlayerService implements IComPlayerService {
  constructor(
    @Inject('ICardService')
    private readonly cardService: ICardService,
  ) {}

  createComPlayer(seatIndex: number, team: Team): Player {
    return {
      id: `com-${seatIndex}`,
      playerId: `com-${seatIndex}`,
      name: `COM ${seatIndex + 1}`,
      hand: [],
      team,
      isPasser: false,
      isCOM: true,
      hasBroken: false,
      hasRequiredBroken: false,
    };
  }

  selectBestCard(
    hand: string[],
    field: Field | null,
    trump: TrumpType | null,
  ): string {
    if (hand.length === 0) {
      throw new Error('COM player has no cards in hand');
    }

    const baseSuit = field?.baseCard
      ? this.cardService.getCardSuit(field.baseCard, trump, undefined)
      : '';

    let validCards = hand;
    if (baseSuit && field?.baseCard) {
      const suitCards = hand.filter(
        (card) =>
          this.cardService.getCardSuit(card, trump, baseSuit) === baseSuit,
      );
      if (suitCards.length > 0) {
        validCards = suitCards;
      }
    }

    let bestCard = validCards[0];
    let bestStrength = this.cardService.getCardStrength(
      bestCard,
      baseSuit,
      trump,
    );

    for (const card of validCards.slice(1)) {
      const strength = this.cardService.getCardStrength(card, baseSuit, trump);
      if (strength > bestStrength) {
        bestCard = card;
        bestStrength = strength;
      }
    }

    return bestCard;
  }

  selectBaseSuit(hand: string[], trump: TrumpType | null): string {
    const suitStats = new Map<
      string,
      {
        count: number;
        bestStrength: number;
      }
    >();

    for (const card of hand) {
      if (card === 'JOKER') {
        continue;
      }

      const suit = this.cardService.getCardSuit(card, trump, undefined);
      if (!suit) {
        continue;
      }

      const strength = this.cardService.getCardStrength(card, suit, trump);
      const stats = suitStats.get(suit) ?? { count: 0, bestStrength: -1 };
      suitStats.set(suit, {
        count: stats.count + 1,
        bestStrength: Math.max(stats.bestStrength, strength),
      });
    }

    const preferredSuits = ['♠', '♥', '♦', '♣'];
    let selectedSuit = preferredSuits[0];
    let selectedCount = -1;
    let selectedStrength = -1;

    for (const suit of preferredSuits) {
      const stats = suitStats.get(suit);
      if (!stats) {
        continue;
      }

      if (
        stats.count > selectedCount ||
        (stats.count === selectedCount && stats.bestStrength > selectedStrength)
      ) {
        selectedSuit = suit;
        selectedCount = stats.count;
        selectedStrength = stats.bestStrength;
      }
    }

    return selectedSuit;
  }

  isComPlayer(player: Player | { isCOM?: boolean; playerId: string }): boolean {
    return player.isCOM === true || player.playerId.startsWith('com-');
  }
}
