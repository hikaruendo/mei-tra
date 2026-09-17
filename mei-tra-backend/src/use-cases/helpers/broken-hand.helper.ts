import { DomainPlayer, GameState } from '../../types/game.types';
import type { SeatId } from '../../types/identity.types';
import type { GameMode } from '../../types/room.types';

export const BROKEN_HAND_REVEAL_PENDING_ERROR = 'Broken hand reveal is pending';
export const BROKEN_HAND_REVEAL_DELAY_MS = 5_000;
export const BROKEN_HAND_REVEAL_PENDING_TTL_MS = 10_000;
export const REQUIRED_BROKEN_HAND_REVEAL_ERROR =
  'Required broken hand must be revealed';

type BrokenHandRevealPendingState = Pick<
  GameState,
  'gamePhase' | 'pendingBrokenHandReveal' | 'playState'
>;

/**
 * Takes a revealed hand back off the table. The reveal is written into the
 * play state, which only the redeal replaces, so every path that gives up on
 * the redeal has to clear it or the hand stays face-up for the whole round.
 */
export function clearRevealedHand(
  state: Pick<GameState, 'playState'>,
  seatId: SeatId,
): boolean {
  const playState = state.playState;
  const revealedHands = playState?.revealedHands;
  if (!playState || !revealedHands || !(seatId in revealedHands)) {
    return false;
  }

  const remaining = { ...revealedHands };
  delete remaining[seatId];
  playState.revealedHands = remaining;
  return true;
}

export interface BrokenHandRevealPendingStateStore {
  getState(): BrokenHandRevealPendingState;
  saveState(): Promise<void>;
}

export async function getBrokenHandRevealPendingError(
  stateStore: BrokenHandRevealPendingStateStore,
  now: number = Date.now(),
): Promise<string | null> {
  const state = stateStore.getState();
  if (state.gamePhase !== 'blow') {
    return null;
  }

  const pendingReveal = state.pendingBrokenHandReveal;
  if (!pendingReveal) {
    return null;
  }

  if (now - pendingReveal.startedAt > BROKEN_HAND_REVEAL_PENDING_TTL_MS) {
    state.pendingBrokenHandReveal = null;
    clearRevealedHand(state, pendingReveal.seatId);
    await stateStore.saveState();
    return null;
  }

  return BROKEN_HAND_REVEAL_PENDING_ERROR;
}

// Pro mode leaves a four-jack hand to the player: keeping it is a chombo the
// opponents can report, so bidding and passing stay open.
export function getRequiredBrokenHandRevealError(
  player: Pick<DomainPlayer, 'hasRequiredBroken'>,
  gameMode?: GameMode,
): string | null {
  if (gameMode === 'pro') {
    return null;
  }
  return player.hasRequiredBroken ? REQUIRED_BROKEN_HAND_REVEAL_ERROR : null;
}
