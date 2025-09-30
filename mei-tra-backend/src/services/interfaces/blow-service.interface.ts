import { BlowDeclaration, TrumpType } from '../../types/game.types';

export interface IBlowService {
  isValidDeclaration(
    declaration: { trumpType: TrumpType; numberOfPairs: number },
    currentHighest: BlowDeclaration | null,
  ): boolean;
  findHighestDeclaration(declarations: BlowDeclaration[]): BlowDeclaration;
  createDeclaration(
    playerId: string,
    trumpType: TrumpType,
    numberOfPairs: number,
  ): BlowDeclaration;
}
