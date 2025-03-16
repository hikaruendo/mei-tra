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
    if (!currentHighest) {
      return true; // First declaration is always valid
    }

    // Check if trump type is stronger
    if (
      this.cardService.getTrumpStrength(declaration.trumpType) >
      this.cardService.getTrumpStrength(currentHighest.trumpType)
    ) {
      return true;
    }

    // If same trump type, check number of pairs
    if (declaration.trumpType === currentHighest.trumpType) {
      return declaration.numberOfPairs > currentHighest.numberOfPairs;
    }

    return false;
  }

  findHighestDeclaration(declarations: BlowDeclaration[]): BlowDeclaration {
    return declarations.reduce((highest, current) => {
      if (!highest) return current;

      // Compare trump strengths
      const currentTrumpStrength = this.cardService.getTrumpStrength(
        current.trumpType,
      );
      const highestTrumpStrength = this.cardService.getTrumpStrength(
        highest.trumpType,
      );

      if (currentTrumpStrength > highestTrumpStrength) {
        return current;
      }

      if (currentTrumpStrength === highestTrumpStrength) {
        // If same trump type, compare number of pairs
        if (current.numberOfPairs > highest.numberOfPairs) {
          return current;
        }
      }

      return highest;
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
