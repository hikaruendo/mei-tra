import { render, screen } from '@testing-library/react';
import { GameInfo } from '@/components/game/GameInfo';
import type { TeamScores } from '@/types/game.types';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const labels: Record<string, string> = {
      'common.leave': 'Leave',
      'gameInfo.reach': 'Reach',
      'gameInfo.win': 'WIN',
      'gameInfo.teamRed': 'Red team',
      'gameInfo.teamBlack': 'Black team',
      'room.leaveConfirm.title': 'Leave room',
      'room.leaveConfirm.message': 'Are you sure?',
      'common.cancel': 'Cancel',
    };

    return (key: string) => labels[key] ?? key;
  },
}));

jest.mock('@/components/shared/ConfirmModal', () => ({
  ConfirmModal: () => null,
}));

const renderGameInfo = (teamScores: TeamScores) =>
  render(
    <GameInfo
      pointsToWin={5}
      teamScores={teamScores}
    />,
  );

describe('GameInfo', () => {
  it('marks a team within one point of the target as reaching', () => {
    renderGameInfo({
      0: { deal: 0, blow: 0, play: 0, total: 4 },
      1: { deal: 0, blow: 0, play: 0, total: 2 },
    });

    const teamMeter = screen.getByRole('meter', { name: 'Red team' });

    expect(teamMeter).toHaveAttribute('aria-valuetext', '4/5 Reach');
    expect(screen.getByText('Reach')).toBeInTheDocument();
    expect(screen.getByText('Reach').closest('.gameInfoMeter')).toBeInTheDocument();
  });

  it('marks a team at the target as a winner', () => {
    renderGameInfo({
      0: { deal: 0, blow: 0, play: 0, total: 2 },
      1: { deal: 0, blow: 0, play: 0, total: 5 },
    });

    const teamMeter = screen.getByRole('meter', { name: 'Black team' });

    expect(teamMeter).toHaveAttribute('aria-valuetext', '5/5 WIN');
    expect(screen.getByText('WIN')).toBeInTheDocument();
  });

  it('keeps backend team zero red and team one black', () => {
    renderGameInfo({
      0: { deal: 0, blow: 0, play: 3, total: 3 },
      1: { deal: 0, blow: 0, play: 1, total: 1 },
    });

    expect(screen.getByRole('meter', { name: 'Red team' })).toHaveAttribute(
      'aria-valuetext',
      '3/5',
    );
    expect(screen.getByRole('meter', { name: 'Black team' })).toHaveAttribute(
      'aria-valuetext',
      '1/5',
    );
  });
});
