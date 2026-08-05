import type { BlowAction, BlowDeclaration, Player } from '@/types/game.types';

export type PlayerReplacementMap = Map<string, string>;

const hasPlayerId = (players: Player[], playerId: string): boolean =>
  players.some((player) => player.playerId === playerId);

export const rememberSeatPlayerReplacements = (
  previousPlayers: Player[],
  nextPlayers: Player[],
  replacements: PlayerReplacementMap,
): void => {
  const seatCount = Math.min(previousPlayers.length, nextPlayers.length);

  for (let index = 0; index < seatCount; index += 1) {
    const previousPlayer = previousPlayers[index];
    const nextPlayer = nextPlayers[index];

    if (
      previousPlayer.playerId !== nextPlayer.playerId &&
      previousPlayer.team === nextPlayer.team
    ) {
      replacements.set(previousPlayer.playerId, nextPlayer.playerId);
    }
  }
};

export const resolvePlayerIdForRoster = (
  playerId: string,
  players: Player[],
  replacements: PlayerReplacementMap,
): string => {
  if (hasPlayerId(players, playerId)) {
    return playerId;
  }

  const visited = new Set<string>();
  let candidateId = playerId;

  while (replacements.has(candidateId) && !visited.has(candidateId)) {
    visited.add(candidateId);
    candidateId = replacements.get(candidateId) ?? candidateId;

    if (hasPlayerId(players, candidateId)) {
      return candidateId;
    }
  }

  return playerId;
};

export const resolveDeclarationForRoster = (
  declaration: BlowDeclaration | null,
  players: Player[],
  replacements: PlayerReplacementMap,
): BlowDeclaration | null => {
  if (!declaration) {
    return null;
  }

  const resolvedPlayerId = resolvePlayerIdForRoster(
    declaration.playerId,
    players,
    replacements,
  );

  return resolvedPlayerId === declaration.playerId
    ? declaration
    : { ...declaration, playerId: resolvedPlayerId };
};

export const resolveDeclarationsForRoster = (
  declarations: BlowDeclaration[],
  players: Player[],
  replacements: PlayerReplacementMap,
): BlowDeclaration[] =>
  declarations.map(
    (declaration) =>
      resolveDeclarationForRoster(declaration, players, replacements) ??
      declaration,
  );

export const resolveBlowActionsForRoster = (
  actions: BlowAction[],
  players: Player[],
  replacements: PlayerReplacementMap,
): BlowAction[] => {
  const rosterPlayerIds = new Set(players.map((player) => player.playerId));
  const resolvedActions = actions.map((action) => {
    const resolvedPlayerId = resolvePlayerIdForRoster(
      action.playerId,
      players,
      replacements,
    );

    return resolvedPlayerId === action.playerId
      ? action
      : { ...action, playerId: resolvedPlayerId };
  });

  const representedPlayerIds = new Set(
    resolvedActions
      .map((action) => action.playerId)
      .filter((playerId) => rosterPlayerIds.has(playerId)),
  );

  return resolvedActions.map((action) => {
    if (rosterPlayerIds.has(action.playerId) || action.type !== 'pass') {
      return action;
    }

    const passerCandidates = players.filter(
      (player) => player.isPasser && !representedPlayerIds.has(player.playerId),
    );

    if (passerCandidates.length !== 1) {
      return action;
    }

    const [passer] = passerCandidates;
    representedPlayerIds.add(passer.playerId);

    return { ...action, playerId: passer.playerId };
  });
};
