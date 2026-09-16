import {
  ChomboViolation,
  DomainPlayer,
  Field,
  TrumpType,
} from '../../types/game.types';
import type { SeatId } from '../../types/identity.types';

export interface IChomboService {
  resolveReport(
    violations: ChomboViolation[],
    reporterSeatId: SeatId,
    violatorSeatId: SeatId,
    violationType: ChomboViolation['type'],
  ): ChomboViolation | null;
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
      trump?: TrumpType | null;
    },
  ): ChomboViolation | null;
  recordViolation(
    seatId: SeatId,
    type: ChomboViolation['type'],
  ): ChomboViolation;
  checkForBrokenHand(player: DomainPlayer): void;
  checkForRequiredBrokenHand(player: DomainPlayer): void;
}
