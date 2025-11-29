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
      isPasser: true,
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

  isComPlayer(player: Player | { isCOM?: boolean; playerId: string }): boolean {
    return player.isCOM === true || player.playerId.startsWith('com-');
  }
}
