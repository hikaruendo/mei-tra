import type { Team, TeamNames } from '@/types/game.types';

const DEFAULT_TEAM_NAMES: Record<Team, string> = {
  0: '赤',
  1: '黒',
};

export const normalizeTeamNames = (teamNames?: TeamNames): TeamNames => ({
  0: teamNames?.[0]?.trim() || DEFAULT_TEAM_NAMES[0],
  1: teamNames?.[1]?.trim() || DEFAULT_TEAM_NAMES[1],
});

export const getTeamDisplayName = (
  team: Team,
  teamNames?: TeamNames,
  fallback?: (team: Team) => string,
): string => {
  const customName = teamNames?.[team]?.trim();
  if (customName) {
    return customName;
  }

  return fallback?.(team) ?? DEFAULT_TEAM_NAMES[team];
};
