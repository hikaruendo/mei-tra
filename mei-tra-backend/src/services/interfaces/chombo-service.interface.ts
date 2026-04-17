import { ChomboViolation, DomainPlayer, Field } from '../../types/game.types';

export interface IChomboService {
  checkViolations(
    playerId: string,
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
    playerId: string,
    type: ChomboViolation['type'],
  ): ChomboViolation;
  reportViolation(
    reporterId: string,
    violatorId: string,
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
