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
    const baseSuit = this.cardService.getCardSuit(
      baseCard,
      trumpSuit,
      field.baseSuit,
    );
    let winner: Player | null = null;
    let highestStrength = -1;

    // Find the dealer's index
    const dealerIndex = players.findIndex((p) => p.playerId === field.dealerId);
    if (dealerIndex === -1) return null;

    // Ensure that the dealer and player order match updated socket IDs
    const updatedPlayerOrder = field.cards.map((_, i) => {
      const index = (dealerIndex + i) % players.length;
      return players[index];
    });

    field.cards.forEach((card, cardIndex) => {
      const player = updatedPlayerOrder[cardIndex];
      const strength = this.cardService.getCardStrength(
        card,
        baseSuit,
        trumpSuit,
      );
      if (strength > highestStrength && player) {
        highestStrength = strength;
        winner = player;
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
  ): { isValid: boolean; message?: string } {
    // In Tanzen round, if player has Joker, they must play it
    if (isTanzenRound && playerHand.includes('JOKER')) {
      if (card !== 'JOKER') {
        return {
          isValid: false,
          message: 'In Tanzen round, you must play the Joker if you have it.',
        };
      }
      return { isValid: true };
    }

    if (card === 'JOKER') {
      return { isValid: true };
    }

    // If no cards in field, any card is valid
    if (field.cards.length === 0) {
      return { isValid: true };
    }

    const baseCard = field.baseCard;
    // If baseCard is Joker and currentTrump is not 'tra', use currentTrump as baseSuit
    const trumpSuit =
      currentTrump && currentTrump !== ('tra' as TrumpType)
        ? this.cardService.getTrumpSuit(currentTrump)
        : '';
    const baseSuit =
      baseCard === 'JOKER' &&
      currentTrump &&
      currentTrump !== ('tra' as TrumpType)
        ? trumpSuit
        : this.cardService.getCardSuit(baseCard, currentTrump, field.baseSuit);
    const cardSuit = this.cardService.getCardSuit(card, currentTrump, baseSuit);

    // If no trump is set (Tra) or trump is not Tra, use normal suit matching rules
    if (!currentTrump || currentTrump === 'tra') {
      if (cardSuit === baseSuit) {
        return { isValid: true };
      }

      if (
        playerHand.some((c) => this.cardService.getCardSuit(c) === baseSuit)
      ) {
        return {
          isValid: false,
          message: `You must play a card of suit ${baseSuit}`,
        };
      }
      return { isValid: true };
    }

    // Special case: When baseCard is Joker and currentTrump is not 'tra'
    if (
      baseCard === 'JOKER' &&
      currentTrump &&
      currentTrump !== ('tra' as TrumpType)
    ) {
      // If player has trump suit cards, they must play one
      const hasTrumpSuit = playerHand.some(
        (c) => this.cardService.getCardSuit(c, currentTrump) === trumpSuit,
      );
      if (hasTrumpSuit && cardSuit !== trumpSuit) {
        return {
          isValid: false,
          message: `You must play a ${trumpSuit} card when Joker is the base card`,
        };
      }
      return { isValid: true };
    }

    // Normal suit matching rules
    if (baseCard) {
      // If player has the base suit, they must play it
      if (baseSuit !== cardSuit) {
        const hasBaseSuit = playerHand.some(
          (c) => this.cardService.getCardSuit(c, currentTrump) === baseSuit,
        );
        if (hasBaseSuit) {
          return {
            isValid: false,
            message: `You must play a card of suit ${baseSuit}.`,
          };
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
        if (card !== 'JOKER') {
          return {
            isValid: false,
            message:
              'You must play the Joker since you have no cards of the trump suit.',
          };
        }
        return { isValid: true };
      }

      // If player has Joker and no trump cards, they must play Joker
      if (
        baseSuit === trumpSuit &&
        playerHand.includes('JOKER') &&
        !playerHand.some(
          (c) => this.cardService.getCardSuit(c, currentTrump) === trumpSuit,
        )
      ) {
        if (card !== 'JOKER') {
          return {
            isValid: false,
            message: `You must play the Joker since you have no ${trumpSuit} cards.`,
          };
        }
        return { isValid: true };
      }
    }

    return { isValid: true };
  }
}
