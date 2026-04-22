import { render, screen } from '@testing-library/react';
import { GameDock } from '@/components/game/GameDock';

jest.mock('@/hooks/useKeyboardOffset', () => ({
  useKeyboardOffset: () => 0,
}));

jest.mock('@/components/game/StrengthOrderDock', () => ({
  StrengthOrderDock: () => <div>strength dock</div>,
}));

jest.mock('@/components/social/ChatDock', () => ({
  ChatDock: () => <div>chat dock</div>,
}));

describe('GameDock', () => {
  it('renders gameplay utility docks without the in-game history dock', () => {
    render(
      <GameDock
        roomId="room-1"
        gameStarted
        currentTrump={null}
        gamePhase="play"
      />,
    );

    expect(screen.getByText('strength dock')).toBeInTheDocument();
    expect(screen.getByText('chat dock')).toBeInTheDocument();
    expect(screen.queryByText('Replay Log')).not.toBeInTheDocument();
    expect(screen.queryByText('対局ログ')).not.toBeInTheDocument();
  });
});
