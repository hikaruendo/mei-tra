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
    hand: string[],
    card: string,
    field: Field,
    currentTrump: TrumpType | null,
    isTanzenRound: boolean,
  ): boolean {
    // First card in field
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

    // Tanzen (Joker) can be played anytime, except in Tanzen round when player has other cards
    if (cardValue === 'JOKER') {
      if (isTanzenRound && hand.length > 1) {
        return false;
      }
      return true;
    }

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
