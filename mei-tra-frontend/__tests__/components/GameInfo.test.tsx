import { render, screen } from '@testing-library/react';
import { GameInfo } from '@/components/game/GameInfo';
import type { Player, TeamScores } from '@/types/game.types';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const labels: Record<string, string> = {
      'common.leave': 'Leave',
      'gameInfo.reach': 'Reach',
      'gameInfo.win': 'WIN',
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

const players: Player[] = [
  {
    socketId: 'player-1',
    playerId: 'player-1',
    name: 'Player 1',
    team: 0,
    hand: [],
  },
  {
    socketId: 'player-2',
    playerId: 'player-2',
    name: 'Player 2',
    team: 1,
    hand: [],
  },
];

const renderGameInfo = (teamScores: TeamScores) =>
  render(
    <GameInfo
      players={players}
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

    const teamMeter = screen.getByRole('meter', { name: 'Player 1' });

    expect(teamMeter).toHaveAttribute('aria-valuetext', '4/5 Reach');
    expect(screen.getByText('Reach')).toBeInTheDocument();
  });

  it('marks a team at the target as a winner', () => {
    renderGameInfo({
      0: { deal: 0, blow: 0, play: 0, total: 2 },
      1: { deal: 0, blow: 0, play: 0, total: 5 },
    });

    const teamMeter = screen.getByRole('meter', { name: 'Player 2' });

    expect(teamMeter).toHaveAttribute('aria-valuetext', '5/5 WIN');
    expect(screen.getByText('WIN')).toBeInTheDocument();
  });
});
