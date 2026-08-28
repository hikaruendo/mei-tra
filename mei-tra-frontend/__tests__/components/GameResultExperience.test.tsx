import { act, fireEvent, render, screen } from '@testing-library/react';
import { asSeatId } from '@contracts/ids';
import { GAME_RESULT_REVEAL_MS, type GameResultSnapshot } from '@meitra/game-client/game-result';

import { GameResultExperience } from '@/components/game/GameResultExperience';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    key === 'spectatorVictory' ? `${String(params?.team)} team wins` : key,
}));

const result: GameResultSnapshot = {
  token: 1,
  winningTeam: 0,
  viewerRole: 'winner',
  teamNames: { 0: 'Sun', 1: 'Moon' },
  teams: [
    { team: 0, total: 5, members: [{ seatId: asSeatId('a'), name: 'Alice', initial: 'A', isCOM: false }] },
    { team: 1, total: 3, members: [{ seatId: asSeatId('b'), name: 'Bob', initial: 'B', isCOM: false }] },
  ],
};

const mockReducedMotion = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({ matches, media: '', addEventListener: jest.fn(), removeEventListener: jest.fn() })),
  });
};

describe('GameResultExperience', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion(false);
  });
  afterEach(() => jest.useRealTimers());

  it('moves from the reveal to a persistent result after 1.8 seconds', () => {
    render(<GameResultExperience result={result} onClose={jest.fn()} />);
    expect(screen.getByText('victory')).toBeInTheDocument();
    expect(screen.queryByText('finalResult')).not.toBeInTheDocument();
    act(() => jest.advanceTimersByTime(GAME_RESULT_REVEAL_MS));
    expect(screen.getByText('finalResult')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('skips on tap and closes only from the room-list button', () => {
    const onClose = jest.fn();
    render(<GameResultExperience result={result} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByText('finalResult')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'toRooms' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the static result immediately when reduced motion is enabled', () => {
    mockReducedMotion(true);
    render(<GameResultExperience result={result} onClose={jest.fn()} />);
    expect(screen.getByText('finalResult')).toBeInTheDocument();
  });

  it('keeps keyboard focus inside the result dialog and restores it on unmount', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(
      <GameResultExperience
        result={result}
        onClose={jest.fn()}
        onRegister={jest.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);

    const register = screen.getByRole('button', {
      name: 'gameOver.guestPromptCta',
    });
    const close = screen.getByRole('button', { name: 'toRooms' });

    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(register).toHaveFocus();
    close.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(register).toHaveFocus();
    register.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(close).toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
