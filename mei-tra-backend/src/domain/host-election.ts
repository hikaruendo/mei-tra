import type { SeatId } from '../types/identity.types';

interface HostCandidate {
  seatId: SeatId;
  isCOM?: boolean;
}

/**
 * Round results only advance when the host confirms them, so the host has to
 * be a seated human who can press that button. A human with a live socket is
 * preferred; one mid-reconnect still beats COM. Returns null when only COM
 * seats remain.
 */
export function electHost(
  candidates: readonly HostCandidate[],
  isConnected: (seatId: SeatId) => boolean,
): SeatId | null {
  const humans = candidates.filter((candidate) => !candidate.isCOM);
  const elected =
    humans.find((candidate) => isConnected(candidate.seatId)) ?? humans[0];
  return elected?.seatId ?? null;
}

export function isHostSeatPlayedByCom(room: {
  hostSeatId: SeatId;
  players: readonly HostCandidate[];
}): boolean {
  return !room.players.some(
    (player) => player.seatId === room.hostSeatId && !player.isCOM,
  );
}

/**
 * Once every human had gone the host stayed on a COM seat. The first human to
 * take a seat back becomes host, so round results wait on a person again.
 */
export function returnHostToHuman(
  room: {
    hostSeatId: SeatId;
    players: (HostCandidate & { isHost: boolean })[];
  },
  seatId: SeatId,
): void {
  if (!isHostSeatPlayedByCom(room)) {
    return;
  }
  room.hostSeatId = seatId;
  room.players.forEach((player) => {
    player.isHost = player.seatId === seatId;
  });
}
