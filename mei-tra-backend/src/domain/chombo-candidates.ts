import type { ChomboViolation, GameState } from '../types/game.types';
import type { SeatId } from '../types/identity.types';

// A candidate stays reportable until someone reports it or it expires.
const isOpen = (candidate: ChomboViolation) =>
  !candidate.isExpired && !candidate.reportedBySeatId;

export function findActiveChomboCandidate(
  candidates: ChomboViolation[],
  violatorSeatId: SeatId,
  type: ChomboViolation['type'],
): ChomboViolation | undefined {
  return candidates.find(
    (candidate) =>
      candidate.violatorSeatId === violatorSeatId &&
      candidate.type === type &&
      isOpen(candidate),
  );
}

export function appendChomboCandidate(
  candidates: ChomboViolation[],
  candidate: ChomboViolation | null | undefined,
): ChomboViolation[] {
  if (
    !candidate ||
    findActiveChomboCandidate(
      candidates,
      candidate.violatorSeatId,
      candidate.type,
    )
  ) {
    return candidates;
  }
  return [...candidates, candidate];
}

/**
 * Whether a last tanzen is on the table and someone can still report it: the
 * violator has played the Joker as their last card, so everyone can see it,
 * and a human sits on the other team. COM seats never report.
 */
export function isLastTanzenAwaitingReport(
  state: Pick<GameState, 'players' | 'playState'>,
): boolean {
  return (state.playState?.chomboViolations ?? []).some((candidate) => {
    if (candidate.type !== 'last-tanzen' || !isOpen(candidate)) return false;
    const violator = state.players.find(
      (player) => player.seatId === candidate.violatorSeatId,
    );
    return Boolean(
      violator &&
        violator.hand.length === 0 &&
        state.players.some(
          (player) => !player.isCOM && player.team !== violator.team,
        ),
    );
  });
}
