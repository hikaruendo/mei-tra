import { asSeatId } from './identity.types';
import type { GameState } from './game.types';

export function normalizeGameStateIdentityAliases(state: GameState): GameState {
  const currentSeatValue =
    state.currentSeatId ??
    state.currentPlayerId ??
    state.players[state.currentPlayerIndex]?.playerId ??
    null;
  const currentSeatId = currentSeatValue ? asSeatId(currentSeatValue) : null;
  const players = state.players.map((player) => {
    const seatId = player.seatId ?? asSeatId(player.playerId);
    return { ...player, seatId, playerId: seatId };
  });
  const blowState = {
    ...state.blowState,
    declarations: state.blowState.declarations.map((declaration) => {
      const seatId = declaration.seatId ?? asSeatId(declaration.playerId);
      return { ...declaration, seatId, playerId: seatId };
    }),
    actionHistory: state.blowState.actionHistory.map((action) => {
      const seatId = action.seatId ?? asSeatId(action.playerId);
      return { ...action, seatId, playerId: seatId };
    }),
    currentHighestDeclaration: state.blowState.currentHighestDeclaration
      ? (() => {
          const declaration = state.blowState.currentHighestDeclaration;
          const seatId = declaration.seatId ?? asSeatId(declaration.playerId);
          return { ...declaration, seatId, playerId: seatId };
        })()
      : null,
    lastPasserSeatId:
      state.blowState.lastPasserSeatId ??
      (state.blowState.lastPasser
        ? asSeatId(state.blowState.lastPasser)
        : null),
    lastPasser:
      state.blowState.lastPasserSeatId ?? state.blowState.lastPasser ?? null,
  };
  const playState = state.playState
    ? {
        ...state.playState,
        ...(() => {
          const negriSeatId =
            state.playState.negriSeatId ??
            (state.playState.negriPlayerId
              ? asSeatId(state.playState.negriPlayerId)
              : state.playState.negriCard && blowState.currentHighestDeclaration
                ? asSeatId(blowState.currentHighestDeclaration.playerId)
                : null);
          return {
            negriSeatId,
            negriPlayerId: negriSeatId,
          };
        })(),
        currentField: state.playState.currentField
          ? (() => {
              const field = state.playState.currentField;
              const playedBy =
                field.playedBySeatIds?.map(asSeatId) ??
                field.playedBy.map(asSeatId);
              const dealerSeatId =
                field.dealerSeatId ?? asSeatId(field.dealerId);
              return {
                ...field,
                playedBy,
                playedBySeatIds: playedBy,
                dealerSeatId,
                dealerId: dealerSeatId,
              };
            })()
          : null,
        fields: state.playState.fields.map((field) => {
          const winnerSeatId = field.winnerSeatId ?? asSeatId(field.winnerId);
          const dealerSeatId = field.dealerSeatId ?? asSeatId(field.dealerId);
          return {
            ...field,
            winnerSeatId,
            winnerId: winnerSeatId,
            dealerSeatId,
            dealerId: dealerSeatId,
          };
        }),
        lastWinnerSeatId:
          state.playState.lastWinnerSeatId ??
          (state.playState.lastWinnerId
            ? asSeatId(state.playState.lastWinnerId)
            : null),
        lastWinnerId:
          state.playState.lastWinnerSeatId ??
          state.playState.lastWinnerId ??
          null,
        openDeclarerSeatId:
          state.playState.openDeclarerSeatId ??
          (state.playState.openDeclarerId
            ? asSeatId(state.playState.openDeclarerId)
            : null),
        openDeclarerId:
          state.playState.openDeclarerSeatId ??
          state.playState.openDeclarerId ??
          null,
      }
    : undefined;
  const pendingBrokenHandReveal = state.pendingBrokenHandReveal
    ? (() => {
        const seatId =
          state.pendingBrokenHandReveal.seatId ??
          asSeatId(state.pendingBrokenHandReveal.playerId);
        return {
          ...state.pendingBrokenHandReveal,
          seatId,
          playerId: seatId,
        };
      })()
    : state.pendingBrokenHandReveal;

  return {
    ...state,
    identitySchemaVersion: 2,
    players,
    currentSeatId,
    currentPlayerId: currentSeatId,
    blowState,
    playState,
    pendingBrokenHandReveal,
    teamAssignments: Object.fromEntries(
      players.map((player) => [player.playerId, player.team]),
    ),
  };
}
