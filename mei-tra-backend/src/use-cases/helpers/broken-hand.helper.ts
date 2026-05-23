import { DomainPlayer, GameState } from '../../types/game.types';

export const BROKEN_HAND_REVEAL_PENDING_ERROR = 'Broken hand reveal is pending';
export const BROKEN_HAND_REVEAL_PENDING_TTL_MS = 10_000;
export const REQUIRED_BROKEN_HAND_REVEAL_ERROR =
  'Required broken hand must be revealed';

type BrokenHandRevealPendingState = Pick<
  GameState,
  'gamePhase' | 'pendingBrokenHandReveal'
>;

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
    await stateStore.saveState();
    return null;
  }

  return BROKEN_HAND_REVEAL_PENDING_ERROR;
}

export function getRequiredBrokenHandRevealError(
  player: Pick<DomainPlayer, 'hasRequiredBroken'>,
): string | null {
  return player.hasRequiredBroken ? REQUIRED_BROKEN_HAND_REVEAL_ERROR : null;
}
