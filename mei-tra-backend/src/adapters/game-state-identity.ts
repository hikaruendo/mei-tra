import { asSeatId } from '../types/identity.types';
import type { Field, GameState } from '../types/game.types';

function normalizePlayedBySeatIds(field: Field) {
  return field.playedBySeatIds.map(asSeatId);
}

export function normalizeGameStateIdentity(state: GameState): GameState {
  const currentSeatId = state.currentSeatId
    ? asSeatId(state.currentSeatId)
    : null;
  const players = state.players.map((player) => {
    return { ...player, seatId: asSeatId(player.seatId) };
  });
  const blowState = {
    ...state.blowState,
    declarations: state.blowState.declarations.map((declaration) => {
      return {
        ...declaration,
        seatId: asSeatId(declaration.seatId),
      };
    }),
    actionHistory: state.blowState.actionHistory.map((action) => {
      return { ...action, seatId: asSeatId(action.seatId) };
    }),
    currentHighestDeclaration: state.blowState.currentHighestDeclaration
      ? (() => {
          const declaration = state.blowState.currentHighestDeclaration;
          return {
            ...declaration,
            seatId: asSeatId(declaration.seatId),
          };
        })()
      : null,
    lastPasserSeatId: state.blowState.lastPasserSeatId ?? null,
  };
  const playState = state.playState
    ? {
        ...state.playState,
        ...(() => {
          const negriSeatId =
            state.playState.negriSeatId ??
            (state.playState.negriCard && blowState.currentHighestDeclaration
              ? blowState.currentHighestDeclaration.seatId
              : null);
          return { negriSeatId };
        })(),
        currentField: state.playState.currentField
          ? (() => {
              const field = state.playState.currentField;
              const playedBySeatIds = normalizePlayedBySeatIds(field);
              const dealerSeatId = field.dealerSeatId;
              return {
                ...field,
                playedBySeatIds: [...playedBySeatIds],
                dealerSeatId,
              };
            })()
          : null,
        fields: state.playState.fields.map((field) => {
          return {
            ...field,
          };
        }),
        lastWinnerSeatId: state.playState.lastWinnerSeatId ?? null,
        openDeclarerSeatId: state.playState.openDeclarerSeatId ?? null,
      }
    : undefined;
  const pendingBrokenHandReveal = state.pendingBrokenHandReveal
    ? (() => {
        return {
          ...state.pendingBrokenHandReveal,
          seatId: asSeatId(state.pendingBrokenHandReveal.seatId),
        };
      })()
    : state.pendingBrokenHandReveal;

  const normalizedState: GameState = {
    ...state,
    identitySchemaVersion: 2,
    players,
    currentSeatId,
    blowState,
    playState,
    pendingBrokenHandReveal,
  };

  return normalizedState;
}
