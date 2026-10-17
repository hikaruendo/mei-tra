import type { RoundSettlement } from '@meitra/contracts/game';
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { RoundSettlementPanel } from '../RoundSettlementPanel';
import { getLocale, setLocale } from '@/i18n';

const playSettlement: RoundSettlement = {
  roundNumber: 2,
  kind: 'play',
  declaringTeam: 0,
  declaredPairs: 6,
  playedFieldsWon: 7,
  awardedUnplayedFields: 0,
  wonFields: 7,
  calculatedPoints: 1.5,
  awardedTeam: 0,
  pointsAwarded: 1.5,
};

async function renderPanel(settlement: RoundSettlement, locale: 'ja' | 'en' = 'ja') {
  setLocale(locale);
  let renderer!: {
    root: {
      findAllByType: (type: typeof Text) => { props: { children: React.ReactNode } }[];
      findAllByProps: (props: Record<string, unknown>) => { type: unknown }[];
    };
    unmount: () => void;
  };
  await act(async () => {
    renderer = TestRenderer.create(
      <RoundSettlementPanel settlement={settlement} />,
    ) as unknown as typeof renderer;
  });
  const texts = renderer.root.findAllByType(Text).map((node) => String(node.props.children));
  const scoreLines = renderer.root
    .findAllByProps({ testID: 'round-score-line' })
    .filter((node) => typeof node.type === 'string');
  await act(async () => renderer.unmount());
  return { texts, scoreLines };
}

describe('RoundSettlementPanel', () => {
  const originalLocale = getLocale();
  afterAll(() => setLocale(originalLocale));

  it('shows only the scoring team, sets, and half-point calculation', async () => {
    const { texts, scoreLines } = await renderPanel(playSettlement);

    expect(scoreLines).toHaveLength(1);
    expect(texts).toContain('赤 +1.5点');
    expect(texts.some((text) => text.startsWith('黒 +'))).toBe(false);
    expect(texts).toContain('宣言6組・獲得7組');
    expect(texts).toContain('(6 − 5) + (7 − 6) × 0.5 = 1.5点');
  });

  it('shows the opposing team for a missed bid', async () => {
    const { texts } = await renderPanel({ ...playSettlement, playedFieldsWon: 1, wonFields: 1, calculatedPoints: -5, awardedTeam: 1, pointsAwarded: 5 });

    expect(texts).toContain('黒 +5点');
    expect(texts.some((text) => text.startsWith('赤 +'))).toBe(false);
    expect(texts).toContain('宣言6組・獲得1組');
    expect(texts).toContain('未達: 1 − 6 = -5点');
  });

  it('hides the score line when no points are awarded', async () => {
    const { texts, scoreLines } = await renderPanel({ ...playSettlement, declaredPairs: 5, playedFieldsWon: 5, wonFields: 5, calculatedPoints: 0, pointsAwarded: 0 });

    expect(scoreLines).toHaveLength(0);
    expect(texts).toContain('宣言5組・獲得5組');
  });

  it('shows credited remaining sets for an open', async () => {
    const { texts, scoreLines } = await renderPanel({ ...playSettlement, kind: 'open', playedFieldsWon: 4, awardedUnplayedFields: 3 });

    expect(scoreLines).toHaveLength(1);
    expect(texts).toContain('オープン: 獲得4組 + 残り3組 = 7組');
  });

  it.each([
    ['chombo-correct', '反則の指摘が成立'],
    ['chombo-incorrect', '反則の指摘は不成立'],
    ['failed-open', 'オープン失敗'],
  ] as const)('shows one scoring team and a short reason for %s', async (kind, reason) => {
    const { texts, scoreLines } = await renderPanel({ roundNumber: 2, kind, awardedTeam: 1, pointsAwarded: 5 });

    expect(scoreLines).toHaveLength(1);
    expect(texts).toContain('黒 +5点');
    expect(texts.some((text) => text.startsWith('赤 +'))).toBe(false);
    expect(texts).toContain(reason);
  });

  it('uses the same concise set wording in English', async () => {
    const { texts } = await renderPanel(playSettlement, 'en');

    expect(texts).toContain('Bid 6 sets · won 7 sets');
    expect(texts).toContain('(6 − 5) + (7 − 6) × 0.5 = 1.5 points');
  });
});
