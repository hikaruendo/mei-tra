import { BlowDeclaration, Team, TrumpType } from '../../types/game.types';

export interface IBlowService {
  isValidDeclaration(
    declaration: { trumpType: TrumpType; numberOfPairs: number },
    currentHighest: BlowDeclaration | null,
  ): boolean;
  findHighestDeclaration(declarations: BlowDeclaration[]): BlowDeclaration;
  createDeclaration(
    playerId: string,
    team: Team,
    trumpType: TrumpType,
    numberOfPairs: number,
  ): BlowDeclaration;
}
