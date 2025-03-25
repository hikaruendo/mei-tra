import { Injectable } from '@nestjs/common';
import { BlowDeclaration, TrumpType, Player } from '../types/game.types';
import { CardService } from './card.service';

@Injectable()
export class BlowService {
  constructor(private readonly cardService: CardService) {}

  isValidDeclaration(
    declaration: { trumpType: TrumpType; numberOfPairs: number },
    currentHighest: BlowDeclaration | null,
  ): boolean {
    // Check minimum pairs requirement
    if (declaration.numberOfPairs < 6) {
      return false;
    }

    if (!currentHighest) {
      return true; // First declaration is always valid if it meets minimum pairs
    }

    // If number of pairs is greater, allow the declaration regardless of trump type
    if (declaration.numberOfPairs > currentHighest.numberOfPairs) {
      return true;
    }

    // If same number of pairs, check if trump type is stronger
    if (declaration.numberOfPairs === currentHighest.numberOfPairs) {
      return (
        this.cardService.getTrumpStrength(declaration.trumpType) >
        this.cardService.getTrumpStrength(currentHighest.trumpType)
      );
    }

    return false;
  }

  findHighestDeclaration(declarations: BlowDeclaration[]): BlowDeclaration {
    return declarations.reduce((highest, current) => {
      if (!highest) return current;

      // First compare number of pairs
      if (current.numberOfPairs !== highest.numberOfPairs) {
        return current.numberOfPairs > highest.numberOfPairs
          ? current
          : highest;
      }

      // If same number of pairs, compare trump strengths
      const currentTrumpStrength = this.cardService.getTrumpStrength(
        current.trumpType,
      );
      const highestTrumpStrength = this.cardService.getTrumpStrength(
        highest.trumpType,
      );

      return currentTrumpStrength > highestTrumpStrength ? current : highest;
    });
  }

  checkForBrokenHand(player: Player): boolean {
    const hand = player.hand;
    const hasPictureCards = hand.some((card) =>
      ['A', 'K', 'Q', 'J'].includes(card.replace(/[♠♣♥♦]/, '')),
    );
    const queenCount = hand.filter((card) => card.includes('Q')).length;

    return !hasPictureCards || queenCount <= 1;
  }

  createDeclaration(
    playerId: string,
    trumpType: TrumpType,
    numberOfPairs: number,
  ): BlowDeclaration {
    return {
      playerId,
      trumpType,
      numberOfPairs,
      timestamp: Date.now(),
    };
  }
}
