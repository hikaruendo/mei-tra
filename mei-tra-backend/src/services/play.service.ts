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
}
