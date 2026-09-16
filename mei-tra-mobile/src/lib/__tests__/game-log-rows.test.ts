import type {
  GameHistoryReplayEventContract,
  GameHistoryReplayViewContract,
} from '@meitra/contracts/game-history';
import type { SeatId } from '@meitra/contracts/ids';

import {
  buildProEventRows,
  buildRoundTableRows,
  formatBid,
} from '../game-log-rows';

type AnyEvent = GameHistoryReplayEventContract;

const event = (
  over: Partial<AnyEvent> & Pick<AnyEvent, 'id' | 'actionType'>,
): AnyEvent =>
  ({
    timestamp: '2026-01-01T00:00:00.000Z',
    kind: 'round',
    actorSeatId: null,
    roundNumber: 1,
    gamePhase: null,
    summary: '',
    details: {},
    detailItems: [],
    actionData: {},
    ...over,
  }) as AnyEvent;

const scoresEvent = (
  id: string,
  timestamp: string,
  team0: number,
  team1: number,
): AnyEvent =>
  event({
    id,
    actionType: 'round_completed',
    timestamp,
    detailItems: [
      {
        labelKey: 'scores',
        value: {
          kind: 'scores',
          scores: { '0': { total: team0 }, '1': { total: team1 } },
        },
      },
    ],
  } as Partial<AnyEvent> as never);

const replay = (
  rounds: GameHistoryReplayViewContract['rounds'],
): GameHistoryReplayViewContract => ({
  roomId: 'room-1',
  totalEntries: rounds.reduce((n, r) => n + r.events.length, 0),
  rounds,
});

const round = (
  roundNumber: number | null,
  events: AnyEvent[],
): GameHistoryReplayViewContract['rounds'][number] =>
  ({
    roundNumber,
    startedAt: null,
    endedAt: null,
    actionTypes: [],
    actorSeatIds: [],
    entries: [],
    events,
  }) as GameHistoryReplayViewContract['rounds'][number];

describe('formatBid', () => {
  it('reformats the backend English bid into the web wording', () => {
    expect(formatBid('6 pair(s) / herz')).toBe('6組 / ヘル (♥)');
    expect(formatBid('5 pairs / tra')).toBe('5組 / ノートラ');
    expect(formatBid('4 / zuppe')).toBe('4組 / ズッペ (♠)');
  });

  it('falls back to 不明 when there is no declaration', () => {
    expect(formatBid(null)).toBe('不明');
  });
});

describe('buildRoundTableRows', () => {
  it('returns rounds newest-first and drops the pre-game bucket', () => {
    const rows = buildRoundTableRows(
      replay([
        round(null, [event({ id: 'pre', actionType: 'game_started' })]),
        round(1, []),
        round(2, []),
      ]),
    );

    expect(rows.map((r) => r.roundNumber)).toEqual([2, 1]);
  });

  it('turns cumulative totals into per-round deltas', () => {
    const rows = buildRoundTableRows(
      replay([
        round(1, [scoresEvent('c1', '2026-01-01T00:01:00.000Z', 3, 0)]),
        round(2, [scoresEvent('c2', '2026-01-01T00:02:00.000Z', 3, 4)]),
        round(3, [scoresEvent('c3', '2026-01-01T00:03:00.000Z', 8, 4)]),
      ]),
    );

    // rows are newest-first: round 3, 2, 1
    expect(rows[0].scores.map((s) => s.delta)).toEqual(['+5', '0']);
    expect(rows[1].scores.map((s) => s.delta)).toEqual(['0', '+4']);
    expect(rows[2].scores.map((s) => s.delta)).toEqual(['+3', '0']);
  });

  it('marks a round with no round_completed as in progress', () => {
    const rows = buildRoundTableRows(
      replay([round(1, [event({ id: 'a', actionType: 'blow_declared' })])]),
    );

    expect(rows[0].inProgress).toBe(true);
    expect(rows[0].scores.every((s) => s.delta === null)).toBe(true);
  });

  it('resolves the blower from the declaration playerNames', () => {
    const rows = buildRoundTableRows(
      replay([
        round(1, [
          event({
            id: 'd',
            actionType: 'blow_declared',
            actorSeatId: 'p1' as SeatId,
            actionData: { playerNames: { p1: 'あかり' } },
          }),
        ]),
      ]),
    );

    expect(rows[0].blower).toBe('あかり');
  });

  it('falls back to プレイヤー when nothing identifies the blower', () => {
    const rows = buildRoundTableRows(replay([round(1, [])]));
    expect(rows[0].blower).toBe('プレイヤー');
  });

  it('uses custom team names when supplied, else 赤 / 黒', () => {
    const base = replay([
      round(1, [scoresEvent('c1', '2026-01-01T00:01:00.000Z', 1, 2)]),
    ]);

    expect(buildRoundTableRows(base)[0].scores.map((s) => s.label)).toEqual([
      '赤',
      '黒',
    ]);
    expect(
      buildRoundTableRows(base, [], { 0: 'A班', 1: 'B班' })[0].scores.map(
        (s) => s.label,
      ),
    ).toEqual(['A班', 'B班']);
  });

  it('returns an empty table for a null replay', () => {
    expect(buildRoundTableRows(null)).toEqual([]);
  });
});

describe('buildProEventRows', () => {
  const chomboEvent = (over: Partial<AnyEvent> = {}): AnyEvent =>
    event({
      id: 'chombo-1',
      actionType: 'chombo_reported',
      timestamp: '2026-01-01T00:02:00.000Z',
      actorSeatId: 'seat-1' as SeatId,
      actionData: { playerNames: { 'seat-1': 'あかり' } },
      detailItems: [
        {
          labelKey: 'violator',
          value: { kind: 'player', seatId: 'seat-2', playerName: 'ひかる' },
        },
        { labelKey: 'violation', value: { kind: 'text', text: 'negri-forget' } },
        { labelKey: 'awardedTeam', value: { kind: 'team', team: 1 } },
      ],
      ...over,
    } as Partial<AnyEvent> as never);

  const brokenEvent = (over: Partial<AnyEvent> = {}): AnyEvent =>
    event({
      id: 'broken-1',
      actionType: 'broken_hand_revealed',
      timestamp: '2026-01-01T00:01:00.000Z',
      actorSeatId: 'seat-1' as SeatId,
      actionData: { playerNames: { 'seat-1': 'あかり' } },
      detailItems: [
        {
          labelKey: 'nextPlayer',
          value: { kind: 'player', seatId: 'seat-2', playerName: 'ひかる' },
        },
      ],
      ...over,
    } as Partial<AnyEvent> as never);

  it('names the reporter, the violator, the violation and the scoring team', () => {
    const rows = buildProEventRows(replay([round(1, [chomboEvent()])]));

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('chombo-1');
    expect(rows[0].text).toBe('あかりがひかるのネグリ忘れを指摘。黒に5点');
  });

  it('uses the room team name for the scoring team', () => {
    const rows = buildProEventRows(
      replay([round(1, [chomboEvent()])]),
      [],
      { 0: 'A班', 1: 'B班' },
    );

    expect(rows[0].text).toContain('B班に5点');
  });

  it('names the revealer and who bids next on a broken hand', () => {
    const rows = buildProEventRows(replay([round(1, [brokenEvent()])]));

    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe('あかりがブロークンを公開。次: ひかる');
  });

  it('prefers the name stored with the event over the current seat holder', () => {
    const players = [
      { seatId: 'seat-1', name: '別の人' },
      { seatId: 'seat-2', name: 'また別の人' },
    ] as never;

    const rows = buildProEventRows(replay([round(1, [chomboEvent()])]), players);

    expect(rows[0].text).toContain('あかり');
    expect(rows[0].text).toContain('ひかる');
    expect(rows[0].text).not.toContain('別の人');
  });

  it('falls back to the current seat holder when the event stored no name', () => {
    const players = [
      { seatId: 'seat-1', name: '現在の席' },
      { seatId: 'seat-2', name: '次の席' },
    ] as never;

    const rows = buildProEventRows(
      replay([
        round(1, [
          brokenEvent({
            actionData: {},
            detailItems: [
              {
                labelKey: 'nextPlayer',
                value: { kind: 'player', seatId: 'seat-2', playerName: null },
              },
            ],
          } as Partial<AnyEvent> as never),
        ]),
      ]),
      players,
    );

    expect(rows[0].text).toBe('現在の席がブロークンを公開。次: 次の席');
  });

  it('keeps an unknown violation readable and falls back for a missing team', () => {
    const rows = buildProEventRows(
      replay([
        round(1, [
          chomboEvent({
            detailItems: [
              { labelKey: 'violation', value: { kind: 'text', text: 'mystery' } },
            ],
          } as Partial<AnyEvent> as never),
        ]),
      ]),
    );

    expect(rows[0].text).toBe('あかりがプレイヤーのmysteryを指摘。不明に5点');
  });

  it('returns the incidents oldest-first across rounds, ignoring other events', () => {
    const rows = buildProEventRows(
      replay([
        round(1, [
          chomboEvent(),
          event({ id: 'other', actionType: 'card_played' }),
        ]),
        round(2, [brokenEvent()]),
      ]),
    );

    expect(rows.map((row) => row.id)).toEqual(['broken-1', 'chombo-1']);
  });

  it('returns nothing for a null replay or a game without incidents', () => {
    expect(buildProEventRows(null)).toEqual([]);
    expect(
      buildProEventRows(
        replay([round(1, [event({ id: 'a', actionType: 'blow_declared' })])]),
      ),
    ).toEqual([]);
  });
});
