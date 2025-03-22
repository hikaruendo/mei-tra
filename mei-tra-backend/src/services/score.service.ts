import { Injectable } from '@nestjs/common';
import { TeamScore, TeamScoreRecord } from '../types/game.types';

@Injectable()
export class ScoreService {
  calculatePlayPoints(declaredPairs: number, wonFields: number): number {
    const X = declaredPairs;
    const Y = wonFields;

    if (Y >= X) {
      return 0.5 * (Y - X) + X - 5;
    } else {
      return Y - X;
    }
  }

  updateTeamScore(
    team: number,
    points: number,
    scoreRecord: TeamScoreRecord,
  ): TeamScoreRecord {
    let remainingPoints = points;
    const updatedRecord = { ...scoreRecord };

    // First, use remembered 10s if available
    while (remainingPoints >= 10 && updatedRecord.rememberedTen > 0) {
      remainingPoints -= 10;
      updatedRecord.rememberedTen--;
    }

    // Then, use score cards
    while (remainingPoints > 0) {
      // If we have a card that can represent the remaining points exactly
      const exactCard = updatedRecord.cards.find(
        (c) => c.isFaceUp && c.value === remainingPoints,
      );

      if (exactCard) {
        remainingPoints = 0;
        continue;
      }

      // If we need to add a new card
      if (remainingPoints >= 10) {
        updatedRecord.rememberedTen++;
        remainingPoints -= 10;
      } else {
        // Add a new card (2, 3, or 4) face up
        const cardValue = Math.min(4, Math.max(2, Math.ceil(remainingPoints)));
        const suit = team === 0 ? '♥' : '♠'; // Team 0 uses red, Team 1 uses black
        updatedRecord.cards.push({
          value: cardValue,
          suit,
          isFaceUp: true,
        });
        remainingPoints -= cardValue;
      }
    }

    return updatedRecord;
  }

  flipScoreCard(
    team: number,
    cardIndex: number,
    scoreRecord: TeamScoreRecord,
  ): boolean {
    const card = scoreRecord.cards[cardIndex];
    if (!card) return false;

    card.isFaceUp = !card.isFaceUp;
    return true;
  }

  initializeTeamScores(): { [key: number]: TeamScore } {
    return {
      0: { deal: 0, blow: 0, play: 0, total: 0 },
      1: { deal: 0, blow: 0, play: 0, total: 0 },
    };
  }

  initializeTeamScoreRecords(): { [key: number]: TeamScoreRecord } {
    return {
      0: { cards: [], rememberedTen: 0 },
      1: { cards: [], rememberedTen: 0 },
    };
  }
}
