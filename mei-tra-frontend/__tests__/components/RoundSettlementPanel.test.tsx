import { render, screen } from '@testing-library/react';
import type { RoundSettlement } from '@contracts/game';
import { RoundSettlementPanel } from '@/components/game/RoundSettlementPanel';
import ja from '@/messages/ja.json';
import en from '@/messages/en.json';

let mockLocale: 'ja' | 'en' = 'ja';
const mockMessages = { ja, en };
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values: Record<string, string | number> = {}) => {
    const template = (mockMessages[mockLocale].game.roundResult as Record<string, string>)[key];
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
  },
}));

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

function renderPanel(settlement: RoundSettlement, locale: 'ja' | 'en' = 'ja') {
  mockLocale = locale;
  return render(
    <RoundSettlementPanel settlement={settlement} />,
  );
}

describe('RoundSettlementPanel', () => {
  it('shows only the scoring team, sets, and half-point calculation', () => {
    renderPanel(playSettlement);

    expect(screen.getByTestId('round-score-line')).toHaveTextContent('赤 +1.5点');
    expect(screen.queryByText('黒')).not.toBeInTheDocument();
    expect(screen.getByText('宣言6組・獲得7組')).toBeInTheDocument();
    expect(screen.getByText('(6 − 5) + (7 − 6) × 0.5 = 1.5点')).toBeInTheDocument();
  });

  it('shows the opposing team for a missed bid', () => {
    renderPanel({ ...playSettlement, wonFields: 1, playedFieldsWon: 1, calculatedPoints: -5, awardedTeam: 1, pointsAwarded: 5 });

    expect(screen.getByTestId('round-score-line')).toHaveTextContent('黒 +5点');
    expect(screen.queryByText('赤')).not.toBeInTheDocument();
    expect(screen.getByText('宣言6組・獲得1組')).toBeInTheDocument();
    expect(screen.getByText('未達: 1 − 6 = -5点')).toBeInTheDocument();
  });

  it('hides the score line when no points are awarded', () => {
    renderPanel({ ...playSettlement, declaredPairs: 5, playedFieldsWon: 5, wonFields: 5, calculatedPoints: 0, pointsAwarded: 0 });

    expect(screen.queryByTestId('round-score-line')).not.toBeInTheDocument();
    expect(screen.getByText('宣言5組・獲得5組')).toBeInTheDocument();
    expect(screen.getByText('(5 − 5) + (5 − 5) × 0.5 = 0点')).toBeInTheDocument();
  });

  it('shows credited remaining sets for an open', () => {
    renderPanel({ ...playSettlement, kind: 'open', playedFieldsWon: 4, awardedUnplayedFields: 3 });

    expect(screen.getByText('オープン: 獲得4組 + 残り3組 = 7組')).toBeInTheDocument();
    expect(screen.getAllByTestId('round-score-line')).toHaveLength(1);
  });

  it.each(['chombo-correct', 'chombo-incorrect', 'failed-open'] as const)(
    'shows one scoring team and a short reason for %s',
    (kind) => {
      renderPanel({ roundNumber: 2, kind, awardedTeam: 1, pointsAwarded: 5 });

      expect(screen.getByTestId('round-score-line')).toHaveTextContent('黒 +5点');
      expect(screen.queryByText('赤')).not.toBeInTheDocument();
      expect(screen.getByText(ja.game.roundResult[kind])).toBeInTheDocument();
    },
  );

  it('uses the same concise set wording in English', () => {
    renderPanel(playSettlement, 'en');

    expect(screen.getByText('Bid 6 sets · won 7 sets')).toBeInTheDocument();
    expect(screen.getByText('(6 − 5) + (7 − 6) × 0.5 = 1.5 points')).toBeInTheDocument();
  });
});
