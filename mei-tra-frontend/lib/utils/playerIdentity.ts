export interface PlayerIdentity {
  playerId: string;
  userId?: string;
}

export function resolveSelfPlayerId<T extends PlayerIdentity>(
  players: T[],
  options: {
    userId?: string | null;
    serverPlayerId?: string | null;
    fallbackPlayerId?: string | null;
  },
): string | null {
  if (
    options.serverPlayerId &&
    players.some((player) => player.playerId === options.serverPlayerId)
  ) {
    return options.serverPlayerId;
  }

  if (options.userId) {
    const authenticatedMatches = players.filter(
      (player) => player.userId === options.userId,
    );
    if (authenticatedMatches.length === 1) {
      return authenticatedMatches[0].playerId;
    }
  }

  if (
    options.fallbackPlayerId &&
    players.some((player) => player.playerId === options.fallbackPlayerId)
  ) {
    return options.fallbackPlayerId;
  }

  return null;
}
