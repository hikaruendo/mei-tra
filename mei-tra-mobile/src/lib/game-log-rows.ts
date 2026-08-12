import type {
  GameHistoryReplayEventContract,
  GameHistoryReplayViewContract,
} from '@meitra/contracts/game-history';
import type { Team, TeamNames } from '@meitra/contracts/game';
import type { MobilePlayer } from '@/types/game';

import { getTeamDisplayName } from './team-labels';
import { trumpLabel } from './trump-labels';

/**
 * Derives the round-summary table shown in 対局ログ, mirroring the web dock
 * (mei-tra-frontend/components/game/GameHistoryDock.tsx).
 *
 * Kept as a pure function, separate from the renderer, so the interesting parts
 * — score deltas, the blower fallback chain, bid reformatting — are unit
 * testable. The mobile test setup cannot render React Native components.
 */
export interface RoundScoreCell {
  team: Team;
  label: string;
  /** Formatted delta: '+3', '-1', '—', or null while the round is unfinished. */
  delta: string | null;
}

export interface RoundRow {
  roundNumber: number;
  blower: string;
  bid: string;
  scores: RoundScoreCell[];
  inProgress: boolean;
}

const UNKNOWN = '不明';
const PARTICIPANT = 'プレイヤー';

function getTextDetail(
  event: GameHistoryReplayEventContract | undefined,
  labelKey: string,
): string | null {
  if (!event) return null;
  const item = event.detailItems.find((detail) => detail.labelKey === labelKey);
  if (!item) return null;
  const value = item.value as { kind?: string; text?: string; name?: string };
  return value?.text ?? value?.name ?? null;
}

function playerNamesOf(
  event: GameHistoryReplayEventContract | undefined,
): Record<string, string> {
  const names = event?.actionData?.playerNames;
  return typeof names === 'object' && names !== null
    ? (names as Record<string, string>)
    : {};
}

/**
 * Cumulative per-team totals carried on a `round_completed` event, keyed by
 * team. Ported from `extractScoreTotals`.
 */
function extractScoreTotals(
  event: GameHistoryReplayEventContract,
): Record<string, number> | null {
  const item = event.detailItems.find((detail) => detail.labelKey === 'scores');
  if (!item) return null;
  const value = item.value as {
    kind?: string;
    scores?: Record<string, { total?: number }>;
  };
  if (!value?.scores) return null;

  const totals: Record<string, number> = {};
  for (const [team, score] of Object.entries(value.scores)) {
    if (typeof score?.total === 'number') totals[team] = score.total;
  }
  return Object.keys(totals).length > 0 ? totals : null;
}

/**
 * Walks every `round_completed` event in chronological order and turns the
 * cumulative totals into per-round deltas.
 *
 * NOTE: the contract types `timestamp` as an ISO string (web maps it to a
 * `Date` first), so this parses rather than calling `.getTime()`.
 */
function buildScoreDeltas(
  replay: GameHistoryReplayViewContract,
): Map<string, Record<string, number>> {
  const completions = replay.rounds
    .flatMap((round) => round.events)
    .filter((event) => event.actionType === 'round_completed')
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const deltas = new Map<string, Record<string, number>>();
  let previous: Record<string, number> = {};

  for (const event of completions) {
    const totals = extractScoreTotals(event);
    if (!totals) continue;

    const delta: Record<string, number> = {};
    for (const [team, total] of Object.entries(totals)) {
      delta[team] = total - (previous[team] ?? 0);
    }
    deltas.set(event.id, delta);
    previous = totals;
  }

  return deltas;
}

/** '6 pair(s) / herz' → '6組 / ヘル (♥)' */
export function formatBid(rawBid: string | null): string {
  if (!rawBid) return UNKNOWN;

  const [countPart, trumpPart] = rawBid.split(' / ');
  const match = countPart
    ?.trim()
    .match(/^(\d+(?:\.\d+)?)\s*(?:pairs?|pair\(s\)|sets?|set\(s\)|組)?$/i);

  const count = match ? `${match[1]}組` : countPart?.trim();
  const trump = trumpPart ? trumpLabel(trumpPart.trim()) : null;

  if (count && trump) return `${count} / ${trump}`;
  return count || trump || UNKNOWN;
}

function formatDelta(delta: number | undefined): string {
  if (delta === undefined) return '—';
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function buildRoundTableRows(
  replay: GameHistoryReplayViewContract | null,
  players: MobilePlayer[] = [],
  teamNames?: TeamNames,
): RoundRow[] {
  if (!replay) return [];

  const scoreDeltas = buildScoreDeltas(replay);

  return replay.rounds
    // The pre-game bucket has no round number; web filters it out of the table.
    .filter((round) => round.roundNumber !== null)
    .slice()
    .sort((a, b) => (b.roundNumber ?? 0) - (a.roundNumber ?? 0))
    .map((round) => {
      const declarations = round.events.filter(
        (event) => event.actionType === 'blow_declared',
      );
      const declaration = declarations[declarations.length - 1];
      const playStarted = round.events.find(
        (event) => event.actionType === 'play_phase_started',
      );
      const completions = round.events.filter(
        (event) => event.actionType === 'round_completed',
      );
      const completion = completions[completions.length - 1];

      // Blower fallback chain, matching web.
      const blower =
        (declaration?.playerId
          ? playerNamesOf(declaration)[declaration.playerId]
          : null) ??
        getTextDetail(playStarted, 'winner') ??
        (playStarted?.playerId
          ? playerNamesOf(playStarted)[playStarted.playerId]
          : null) ??
        players.find((player) => player.playerId === declaration?.playerId)
          ?.name ??
        PARTICIPANT;

      const bid = formatBid(
        getTextDetail(declaration, 'highestDeclaration') ??
          getTextDetail(declaration, 'declaration'),
      );

      const delta = completion ? scoreDeltas.get(completion.id) : undefined;

      return {
        roundNumber: round.roundNumber as number,
        blower,
        bid,
        inProgress: !completion,
        scores: ([0, 1] as Team[]).map((team) => ({
          team,
          label: getTeamDisplayName(team, teamNames),
          delta: completion ? formatDelta(delta?.[String(team)]) : null,
        })),
      };
    });
}
