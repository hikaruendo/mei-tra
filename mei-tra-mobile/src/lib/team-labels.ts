import type { Team, TeamNames } from '@meitra/contracts/game';

import { t } from '@/i18n';

/**
 * Team display names, ported from mei-tra-frontend/lib/utils/teamLabels.ts so
 * both platforms agree. A room's own team names win when set.
 */
const DEFAULT_TEAM_NAME_KEYS: Record<Team, string> = {
  0: 'team.red',
  1: 'team.black',
};

export function getTeamDisplayName(team: Team, teamNames?: TeamNames): string {
  return teamNames?.[team]?.trim() || t(DEFAULT_TEAM_NAME_KEYS[team]);
}
