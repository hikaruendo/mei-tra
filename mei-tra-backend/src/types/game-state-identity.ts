import { asSeatId } from './identity.types';
import type { Field, GameState } from './game.types';

function normalizePlayedBySeatIds(field: Field) {
  const playedBySeatIds = (field.playedBySeatIds ?? field.playedBy).map(
    asSeatId,
  );
  const hasDuplicatedAttributions =
    field.cards.length > 0 &&
    playedBySeatIds.length === field.cards.length * 2 &&
    field.cards.every(
      (_, cardIndex) =>
        playedBySeatIds[cardIndex * 2] === playedBySeatIds[cardIndex * 2 + 1],
    );

  return hasDuplicatedAttributions
    ? field.cards.map((_, cardIndex) => playedBySeatIds[cardIndex * 2])
    : playedBySeatIds;
}

export function normalizeGameStateIdentityAliases(state: GameState): GameState {
  const currentSeatId = state.currentSeatId
    ? asSeatId(state.currentSeatId)
    : null;
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
    lastPasserSeatId: state.blowState.lastPasserSeatId ?? null,
  };
  const playState = state.playState
    ? {
        ...state.playState,
        ...(() => {
          const negriSeatId =
            state.playState.negriSeatId ??
            (state.playState.negriCard && blowState.currentHighestDeclaration
              ? asSeatId(blowState.currentHighestDeclaration.playerId)
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
                playedBy: [...playedBySeatIds],
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

  const normalizedState: GameState = {
    ...state,
    identitySchemaVersion: 2,
    players,
    currentSeatId,
    blowState,
    playState,
    pendingBrokenHandReveal,
    teamAssignments: Object.fromEntries(
      players.map((player) => [player.playerId, player.team]),
    ),
  };

  return normalizedState;
}
