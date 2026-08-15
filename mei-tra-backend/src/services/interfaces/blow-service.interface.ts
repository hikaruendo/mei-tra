import { BlowDeclaration, Team, TrumpType } from '../../types/game.types';
import type { SeatId } from '../../types/identity.types';

export interface IBlowService {
  isValidDeclaration(
    declaration: { trumpType: TrumpType; numberOfPairs: number },
    currentHighest: BlowDeclaration | null,
  ): boolean;
  findHighestDeclaration(declarations: BlowDeclaration[]): BlowDeclaration;
  createDeclaration(
    seatId: SeatId,
    team: Team,
    trumpType: TrumpType,
    numberOfPairs: number,
  ): BlowDeclaration;
}
