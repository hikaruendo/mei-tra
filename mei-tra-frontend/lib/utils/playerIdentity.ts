export interface PlayerIdentity {
  seatId: string;
  userId?: string;
}

export function resolveSelfSeatId<T extends PlayerIdentity>(
  players: T[],
  options: {
    userId?: string | null;
    serverSeatId?: string | null;
    fallbackSeatId?: string | null;
  },
): string | null {
  if (
    options.serverSeatId &&
    players.some((player) => player.seatId === options.serverSeatId)
  ) {
    return options.serverSeatId;
  }

  if (options.userId) {
    const authenticatedMatches = players.filter(
      (player) => player.userId === options.userId,
    );
    if (authenticatedMatches.length === 1) {
      return authenticatedMatches[0].seatId;
    }
  }

  if (
    options.fallbackSeatId &&
    players.some((player) => player.seatId === options.fallbackSeatId)
  ) {
    return options.fallbackSeatId;
  }

  return null;
}
