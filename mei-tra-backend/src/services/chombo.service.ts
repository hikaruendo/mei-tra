import { Injectable } from '@nestjs/common';
import { ChomboViolation, Player, Field } from '../types/game.types';
import { PlayService } from './play.service';

@Injectable()
export class ChomboService {
  private violations: ChomboViolation[] = [];

  constructor(private readonly playService: PlayService) {}

  checkViolations(
    playerId: string,
    action: string,
    context: {
      player: Player;
      field?: Field;
      card?: string;
      neguri?: { [key: string]: string };
      hasBroken?: boolean;
      canDeclareOpen?: boolean;
    },
  ): ChomboViolation | null {
    let violationType: ChomboViolation['type'] | null = null;

    switch (action) {
      case 'select-negri': {
        if (!context.neguri?.[playerId]) {
          violationType = 'negri-forget';
        }
        break;
      }

      case 'check-four-jack': {
        const jackCount = context.player.hand.filter((c) =>
          c.includes('J'),
        ).length;
        if (jackCount === 4 && !context.hasBroken) {
          violationType = 'four-jack';
        }
        break;
      }

      case 'check-last-card': {
        if (
          context.player.hand.length === 1 &&
          context.player.hand[0].includes('JOKER')
        ) {
          violationType = 'last-tanzen';
        }
        break;
      }

      case 'declare-broken': {
        if (!context.hasBroken) {
          violationType = 'wrong-broken';
        }
        break;
      }

      case 'declare-open': {
        if (!context.canDeclareOpen) {
          violationType = 'wrong-open';
        }
        break;
      }
    }

    if (violationType) {
      return this.recordViolation(playerId, violationType);
    }

    return null;
  }

  recordViolation(
    playerId: string,
    type: ChomboViolation['type'],
  ): ChomboViolation {
    const violation: ChomboViolation = {
      type,
      playerId,
      timestamp: Date.now(),
      reportedBy: null,
      isExpired: false,
    };

    this.violations.push(violation);
    return violation;
  }

  reportViolation(
    reporterId: string,
    violatorId: string,
    violationType: ChomboViolation['type'],
    reporterTeam: number,
    violatorTeam: number,
  ): ChomboViolation | null {
    // Can't report your own team
    if (reporterTeam === violatorTeam) {
      return null;
    }

    // Find the violation
    const violation = this.violations.find(
      (v) =>
        v.playerId === violatorId &&
        v.type === violationType &&
        !v.isExpired &&
        !v.reportedBy,
    );

    if (!violation) {
      return null;
    }

    // Mark violation as reported
    violation.reportedBy = reporterId;
    return violation;
  }

  expireViolations(): void {
    this.violations = this.violations.map((v) => ({
      ...v,
      isExpired: true,
    }));
  }

  getActiveViolations(): ChomboViolation[] {
    return this.violations.filter((v) => !v.isExpired && !v.reportedBy);
  }

  clearViolations(): void {
    this.violations = [];
  }

  checkForBrokenHand(player: Player): void {
    const hand = player.hand;
    const hasPictureCards = hand.some((card) =>
      ['A', 'K', 'Q', 'J'].includes(card.replace(/[♠♣♥♦]/, '')),
    );
    const hasPictureButNoQueenCards = hand.some((card) =>
      ['A', 'K', 'J'].includes(card.replace(/[♠♣♥♦]/, '')),
    );
    const queenCount = hand.filter((card) => card.includes('Q')).length;

    if (!hasPictureCards || (!hasPictureButNoQueenCards && queenCount == 1)) {
      player.hasBroken = true;
    }
  }

  checkForRequiredBrokenHand(player: Player): void {
    const hand = player.hand;
    const jackCount = hand.filter(
      (card) => card.includes('J') && card !== 'JOKER',
    ).length;

    if (jackCount == 4) {
      player.hasRequiredBroken = true;
    }
  }
}
