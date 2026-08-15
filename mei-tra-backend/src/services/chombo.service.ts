import { Injectable } from '@nestjs/common';
import { ChomboViolation, DomainPlayer, Field } from '../types/game.types';
import { PlayService } from './play.service';
import { IChomboService } from './interfaces/chombo-service.interface';
import type { SeatId } from '../types/identity.types';

@Injectable()
export class ChomboService implements IChomboService {
  private violations: ChomboViolation[] = [];

  constructor(private readonly playService: PlayService) {}

  checkViolations(
    seatId: SeatId,
    action: string,
    context: {
      player: DomainPlayer;
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
        if (!context.neguri?.[seatId]) {
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
      return this.recordViolation(seatId, violationType);
    }

    return null;
  }

  recordViolation(
    seatId: SeatId,
    type: ChomboViolation['type'],
  ): ChomboViolation {
    const violation: ChomboViolation = {
      type,
      violatorSeatId: seatId,
      timestamp: Date.now(),
      reportedBySeatId: null,
      isExpired: false,
    };

    this.violations.push(violation);
    return violation;
  }

  reportViolation(
    reporterSeatId: SeatId,
    violatorSeatId: SeatId,
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
        v.violatorSeatId === violatorSeatId &&
        v.type === violationType &&
        !v.isExpired &&
        !v.reportedBySeatId,
    );

    if (!violation) {
      return null;
    }

    // Mark violation as reported
    violation.reportedBySeatId = reporterSeatId;
    return violation;
  }

  expireViolations(): void {
    this.violations = this.violations.map((v) => ({
      ...v,
      isExpired: true,
    }));
  }

  getActiveViolations(): ChomboViolation[] {
    return this.violations.filter((v) => !v.isExpired && !v.reportedBySeatId);
  }

  clearViolations(): void {
    this.violations = [];
  }

  checkForBrokenHand(player: DomainPlayer): void {
    const hand = player.hand;

    // Defensive check: filter out undefined cards
    const validCards = hand.filter(
      (card): card is string => card !== undefined,
    );

    if (validCards.length !== hand.length) {
      // Log warning if undefined cards detected
      console.warn(
        `Player ${player.seatId} has ${hand.length - validCards.length} undefined cards`,
      );
    }

    const hasPictureCards = validCards.some((card) =>
      ['A', 'K', 'Q', 'J'].includes(card.replace(/[♠♣♥♦]/, '')),
    );
    const hasPictureButNoQueenCards = validCards.some((card) =>
      ['A', 'K', 'J'].includes(card.replace(/[♠♣♥♦]/, '')),
    );
    const queenCount = validCards.filter((card) => card.includes('Q')).length;

    if (!hasPictureCards || (!hasPictureButNoQueenCards && queenCount == 1)) {
      player.hasBroken = true;
    }
  }

  checkForRequiredBrokenHand(player: DomainPlayer): void {
    const hand = player.hand;

    // Defensive check: filter out undefined cards
    const validCards = hand.filter(
      (card): card is string => card !== undefined,
    );

    const jackCount = validCards.filter(
      (card) => card.includes('J') && card !== 'JOKER',
    ).length;

    if (jackCount == 4) {
      player.hasRequiredBroken = true;
    }
  }
}
