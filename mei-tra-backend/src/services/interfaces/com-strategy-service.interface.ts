import { DomainPlayer, GameState, TrumpType } from '../../types/game.types';

export type ComBlowAction =
  | {
      type: 'declare';
      declaration: {
        trumpType: TrumpType;
        numberOfPairs: number;
      };
    }
  | { type: 'pass' }
  /**
   * The seat has no legal blow action left — it already declared, so both
   * declare-blow and pass-blow reject it. The caller must advance the turn
   * rather than submit an action.
   */
  | { type: 'skip' };

export interface IComStrategyService {
  chooseBlowAction(state: GameState, comPlayer: DomainPlayer): ComBlowAction;
  chooseNegriCard(state: GameState, comPlayer: DomainPlayer): string;
  choosePlayCard(state: GameState, comPlayer: DomainPlayer): string;
  chooseBaseSuit(state: GameState, comPlayer: DomainPlayer): string;
}
