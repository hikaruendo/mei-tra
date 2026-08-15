import { ChomboViolation, DomainPlayer, Field } from '../../types/game.types';
import type { SeatId } from '../../types/identity.types';

export interface IChomboService {
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
  ): ChomboViolation | null;
  recordViolation(
    seatId: SeatId,
    type: ChomboViolation['type'],
  ): ChomboViolation;
  reportViolation(
    reporterSeatId: SeatId,
    violatorSeatId: SeatId,
    violationType: ChomboViolation['type'],
    reporterTeam: number,
    violatorTeam: number,
  ): ChomboViolation | null;
  expireViolations(): void;
  getActiveViolations(): ChomboViolation[];
  clearViolations(): void;
  checkForBrokenHand(player: DomainPlayer): void;
  checkForRequiredBrokenHand(player: DomainPlayer): void;
}
