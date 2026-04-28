import {
  DomainPlayer,
  Field,
  GameState,
  TrumpType,
} from '../../types/game.types';

export type ComBlowAction =
  | {
      type: 'declare';
      declaration: {
        trumpType: TrumpType;
        numberOfPairs: number;
      };
    }
  | { type: 'pass' };

export interface IComStrategyService {
  chooseBlowAction(state: GameState, comPlayer: DomainPlayer): ComBlowAction;
  chooseNegriCard(state: GameState, comPlayer: DomainPlayer): string;
  choosePlayCard(state: GameState, comPlayer: DomainPlayer): string;
  chooseBaseSuit(state: GameState, comPlayer: DomainPlayer): string;
  getLegalPlayCards(
    hand: string[],
    field: Field | null,
    trump: TrumpType | null,
  ): string[];
}
