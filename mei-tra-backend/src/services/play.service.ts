import { Injectable } from '@nestjs/common';
import { Field, Player, TrumpType, CompletedField } from '../types/game.types';
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
    const baseSuit = this.cardService.getCardSuit(
      baseCard,
      trumpSuit,
      field.baseSuit,
    );
    let winner: Player | null = null;
    let highestStrength = -1;

    // Find the dealer's index
    const dealerIndex = players.findIndex((p) => p.id === field.dealerId);
    if (dealerIndex === -1) return null;

    field.cards.forEach((card, cardIndex) => {
      // Calculate the player index based on the dealer's position
      const playerIndex = (dealerIndex + cardIndex) % players.length;
      const strength = this.cardService.getCardStrength(
        card,
        baseSuit,
        trumpSuit,
      );
      if (strength > highestStrength) {
        highestStrength = strength;
        winner = players[playerIndex];
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

    // If no cards in field, any card is valid
    if (field.cards.length === 0) {
      return true;
    }

    const baseCard = field.baseCard;
    const baseSuit = this.cardService.getCardSuit(
      baseCard,
      currentTrump,
      field.baseSuit,
    );
    const cardSuit = this.cardService.getCardSuit(card, currentTrump);

    // If no trump is set (Tra) or trump is not Tra, use normal suit matching rules
    if (!currentTrump || currentTrump === 'tra') {
      if (cardSuit === baseSuit) {
        return true;
      }

      return !playerHand.some(
        (c) => this.cardService.getCardSuit(c) === baseSuit,
      );
    }

    // For other trump types, both primary and secondary Jacks can be played anytime
    if (this.cardService.isJack(card)) {
      return true;
    }

    // Normal suit matching rules
    if (baseCard) {
      const baseSuit = this.cardService.getCardSuit(
        baseCard,
        currentTrump,
        field.baseSuit,
      );
      const cardSuit = this.cardService.getCardSuit(card, currentTrump);

      // If player has the base suit, they must play it
      if (baseSuit !== cardSuit) {
        const hasBaseSuit = playerHand.some(
          (c) => this.cardService.getCardSuit(c, currentTrump) === baseSuit,
        );
        if (hasBaseSuit) {
          return false;
        }
      }

      // If currentTrump matches baseSuit, player has no cards of that suit, and has Joker, they must play Joker
      if (
        currentTrump === baseSuit &&
        playerHand.includes('JOKER') &&
        !playerHand.some(
          (c) => this.cardService.getCardSuit(c, currentTrump) === baseSuit,
        )
      ) {
        return card === 'JOKER';
      }
    }

    return true;
  }

  determineWinningTeam(fields: CompletedField[], players: Player[]): number {
    const team0Score = fields.filter(
      (f) => players.find((p) => p.id === f.dealerId)?.team === 0,
    ).length;

    const team1Score = fields.filter(
      (f) => players.find((p) => p.id === f.dealerId)?.team === 1,
    ).length;

    return team0Score > team1Score ? 0 : 1;
  }
}
