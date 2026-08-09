import type { Team, TeamNames } from '@meitra/contracts/game';

/**
 * Team display names, ported from mei-tra-frontend/lib/utils/teamLabels.ts so
 * both platforms agree.
 *
 * Mobile previously defaulted to `{n+1}組` / `チーム{n+1}` in four different
 * components; web has always used 赤 / 黒.
 */
const DEFAULT_TEAM_NAMES: Record<Team, string> = {
  0: '赤',
  1: '黒',
};

export function getTeamDisplayName(team: Team, teamNames?: TeamNames): string {
  return teamNames?.[team]?.trim() || DEFAULT_TEAM_NAMES[team];
}
