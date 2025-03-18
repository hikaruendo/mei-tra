import { Injectable } from '@nestjs/common';
import { Field, Player, TrumpType } from '../types/game.types';
import { CardService } from './card.service';

@Injectable()
export class PlayService {
  constructor(private readonly cardService: CardService) {}

  determineFieldWinner(
    field: Field,
    players: Player[],
    trumpSuit: TrumpType | null,
  ): Player | null {
    const baseCard = field.baseCard;
    const baseSuit = baseCard.replace(/[0-9JQKA]/, '');
    let winner: Player | null = null;
    let highestStrength = -1;

    field.cards.forEach((card, index) => {
      const strength = this.cardService.getCardStrength(
        card,
        baseSuit,
        trumpSuit,
      );
      if (strength > highestStrength) {
        highestStrength = strength;
        winner = players[index];
      }
    });

    return winner;
  }

  canDeclareOpen(player: Player, remainingFields: number): boolean {
    // Check if player can win all remaining sets
    const playerHand = player.hand;
    return playerHand.length >= remainingFields;
  }

  isValidNeguriCard(card: string, hand: string[]): boolean {
    return hand.includes(card);
  }

  isValidCardPlay(
    playerHand: string[],
    card: string,
    field: Field,
    currentTrump: TrumpType | null,
    isTanzenRound: boolean,
  ): boolean {
    // In Tanzen round, if player has Joker, they must play it
    if (isTanzenRound && playerHand.includes('JOKER')) {
      return card === 'JOKER';
    }

    console.log('aaaaaaaa');

    // If no cards in field, any card is valid
    if (field.cards.length === 0) {
      return true;
    }

    console.log('bbbbbbbb');

    const baseCard = field.baseCard;
    const baseSuit = this.cardService.getCardSuit(baseCard);
    const cardSuit = this.cardService.getCardSuit(card);

    // If no trump is set (Tra) or trump is not Tra, use normal suit matching rules
    if (!currentTrump || currentTrump === 'tra') {
      if (cardSuit === baseSuit) {
        return true;
      }

      console.log('cccccccc');

      return !playerHand.some(
        (c) => this.cardService.getCardSuit(c) === baseSuit,
      );
    }

    // For other trump types, both primary and secondary Jacks can be played anytime
    if (this.cardService.isJack(card)) {
      return true;
    }

    console.log('dddddddd');

    // Normal suit matching rules
    if (baseCard) {
      const baseSuit = this.cardService.getCardSuit(baseCard);
      const cardSuit = this.cardService.getCardSuit(card);

      // If player has the base suit, they must play it
      if (baseSuit !== cardSuit) {
        const hasBaseSuit = playerHand.some(
          (c) => this.cardService.getCardSuit(c) === baseSuit,
        );
        if (hasBaseSuit) {
          return false;
        }
      }
    }

    console.log('eeeeee');

    return true;
  }

  determineWinningTeam(fields: Field[], players: Player[]): number {
    const team0Score = fields.filter(
      (f) => players.find((p) => p.id === f.dealerId)?.team === 0,
    ).length;

    const team1Score = fields.filter(
      (f) => players.find((p) => p.id === f.dealerId)?.team === 1,
    ).length;

    return team0Score > team1Score ? 0 : 1;
  }
}
