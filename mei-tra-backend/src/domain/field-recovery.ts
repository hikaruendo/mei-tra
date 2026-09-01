import type { Field, FieldCheckpoint, GameState } from '../types/game.types';
import type { SeatId } from '../types/identity.types';
import { setCurrentSeat } from './current-turn';

const cloneField = (field: Field): Field => ({
  ...field,
  cards: [...field.cards],
  playedBySeatIds: [...field.playedBySeatIds],
});

export const getFieldIntegrityError = (
  state: GameState,
  field: Field,
): string | null => {
  if (field.cards.length !== field.playedBySeatIds.length) {
    return 'Field card/player attribution mismatch';
  }

  if (field.cards.length > state.players.length) {
    return 'Field contains too many plays';
  }

  const playerSeatIds = new Set<SeatId>(
    state.players.map((player) => player.seatId),
  );
  if (!playerSeatIds.has(field.dealerSeatId)) {
    return 'Field contains unknown dealer attribution';
  }
  if (field.playedBySeatIds.some((seatId) => !playerSeatIds.has(seatId))) {
    return 'Field contains unknown player attribution';
  }
  if (new Set(field.playedBySeatIds).size !== field.playedBySeatIds.length) {
    return 'Field contains duplicate player attribution';
  }
  if (new Set(field.cards).size !== field.cards.length) {
    return 'Field contains duplicate cards';
  }

  const expectedBaseCard = field.cards[0] ?? '';
  if (field.baseCard !== expectedBaseCard) {
    return 'Field base card does not match the first play';
  }

  const shouldBeComplete = field.cards.length === state.players.length;
  if (field.isComplete !== shouldBeComplete) {
    return 'Field completion state does not match its plays';
  }

  return null;
};

export const createFieldCheckpoint = (
  state: GameState,
): FieldCheckpoint | null => {
  const currentField = state.playState?.currentField;
  const currentSeatId = state.currentSeatId;
  if (
    !currentField ||
    currentField.cards.length !== 0 ||
    currentField.playedBySeatIds.length !== 0 ||
    !currentSeatId
  ) {
    return null;
  }

  return {
    roundNumber: state.roundNumber,
    currentSeatId,
    handsBySeatId: Object.fromEntries(
      state.players.map((player) => [player.seatId, [...player.hand]]),
    ),
    currentField: cloneField(currentField),
  };
};

export const restoreFieldCheckpoint = (state: GameState): boolean => {
  const playState = state.playState;
  const checkpoint = playState?.fieldCheckpoint;
  if (
    !playState ||
    !checkpoint ||
    checkpoint.roundNumber !== state.roundNumber
  ) {
    return false;
  }

  const playerSeatIds = new Set<SeatId>(
    state.players.map((player) => player.seatId),
  );
  const checkpointSeatIds = Object.keys(checkpoint.handsBySeatId);
  if (
    checkpointSeatIds.length !== state.players.length ||
    !playerSeatIds.has(checkpoint.currentSeatId) ||
    !playerSeatIds.has(checkpoint.currentField.dealerSeatId) ||
    checkpoint.currentField.cards.length !== 0 ||
    checkpoint.currentField.playedBySeatIds.length !== 0 ||
    checkpoint.currentField.baseCard !== '' ||
    checkpoint.currentField.isComplete ||
    checkpointSeatIds.some((seatId) => !playerSeatIds.has(seatId as SeatId))
  ) {
    return false;
  }

  for (const player of state.players) {
    const hand = checkpoint.handsBySeatId[player.seatId];
    if (!Array.isArray(hand)) {
      return false;
    }
    player.hand = [...hand];
  }

  playState.currentField = cloneField(checkpoint.currentField);
  playState.fieldCheckpoint = null;
  setCurrentSeat(state, checkpoint.currentSeatId);
  return true;
};
