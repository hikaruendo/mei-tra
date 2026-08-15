import type {
  BlowActionContract,
  BlowDeclarationContract,
  BlowStateContract,
  BlowUpdatedPayload,
  CompletedFieldContract,
  FieldContract,
} from '@contracts/game';
import type {
  BlowAction,
  BlowDeclaration,
  BlowState,
  CompletedField,
  Field,
} from './game.types';
import { asSeatId } from './identity.types';

export function toBlowDeclarationContract(
  declaration: BlowDeclaration,
): BlowDeclarationContract {
  return {
    seatId: declaration.seatId,
    team: declaration.team,
    trumpType: declaration.trumpType,
    numberOfPairs: declaration.numberOfPairs,
    timestamp: declaration.timestamp,
  };
}

export function toBlowActionContract(action: BlowAction): BlowActionContract {
  return {
    type: action.type,
    seatId: action.seatId,
    trumpType: action.trumpType,
    numberOfPairs: action.numberOfPairs,
    timestamp: action.timestamp,
  };
}

export function toBlowStateContract(state: BlowState): BlowStateContract {
  return {
    currentTrump: state.currentTrump,
    currentHighestDeclaration: state.currentHighestDeclaration
      ? toBlowDeclarationContract(state.currentHighestDeclaration)
      : null,
    declarations: state.declarations.map(toBlowDeclarationContract),
    actionHistory: state.actionHistory.map(toBlowActionContract),
    lastPasserSeatId: state.lastPasserSeatId
      ? asSeatId(state.lastPasserSeatId)
      : null,
    isRoundCancelled: state.isRoundCancelled,
    currentBlowIndex: state.currentBlowIndex,
  };
}

export function toBlowUpdatedPayload(state: BlowState): BlowUpdatedPayload {
  const contract = toBlowStateContract(state);
  return {
    declarations: contract.declarations,
    actionHistory: contract.actionHistory,
    currentHighest: contract.currentHighestDeclaration,
    lastPasserSeatId: contract.lastPasserSeatId,
  };
}

export function toFieldContract(field: Field): FieldContract {
  return {
    cards: [...field.cards],
    playedBySeatIds: (field.playedBySeatIds ?? field.playedBy).map(asSeatId),
    baseCard: field.baseCard,
    baseSuit: field.baseSuit,
    dealerSeatId: field.dealerSeatId,
    declaredSuit: field.declaredSuit,
    isComplete: field.isComplete,
  };
}

export function toCompletedFieldContract(
  field: CompletedField,
): CompletedFieldContract {
  return {
    cards: [...field.cards],
    winnerSeatId: field.winnerSeatId,
    winnerTeam: field.winnerTeam,
    dealerSeatId: field.dealerSeatId,
  };
}
