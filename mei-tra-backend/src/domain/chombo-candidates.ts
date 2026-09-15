import type { ChomboViolation } from '../types/game.types';
import type { SeatId } from '../types/identity.types';

export function findActiveChomboCandidate(
  candidates: ChomboViolation[],
  violatorSeatId: SeatId,
  type: ChomboViolation['type'],
): ChomboViolation | undefined {
  return candidates.find(
    (candidate) =>
      candidate.violatorSeatId === violatorSeatId &&
      candidate.type === type &&
      !candidate.isExpired &&
      !candidate.reportedBySeatId,
  );
}

export function appendChomboCandidate(
  candidates: ChomboViolation[],
  candidate: ChomboViolation | null | undefined,
): ChomboViolation[] {
  if (
    !candidate ||
    findActiveChomboCandidate(candidates, candidate.violatorSeatId, candidate.type)
  ) {
    return candidates;
  }
  return [...candidates, candidate];
}
