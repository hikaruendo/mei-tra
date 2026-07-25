import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GameDock } from '@/components/game/GameDock';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const mockStrengthOrderDock = jest.fn(
  ({ placement }: { placement?: string }) => <div>strength dock {placement}</div>,
);
const mockChatDock = jest.fn(
  ({ placement }: { placement?: string }) => <div>chat dock {placement}</div>,
);
const mockGameHistoryDock = jest.fn(
  ({ defaultOpen }: { defaultOpen?: boolean }) => (
    <div>history dock {defaultOpen ? 'open' : 'closed'}</div>
  ),
);

jest.mock('@/components/game/StrengthOrderDock', () => ({
  StrengthOrderDock: (props: { placement?: string }) => mockStrengthOrderDock(props),
}));

jest.mock('@/components/social/ChatDock', () => ({
  ChatDock: (props: { placement?: string }) => mockChatDock(props),
}));

jest.mock('@/components/game/GameHistoryDock', () => ({
  GameHistoryDock: (props: { defaultOpen?: boolean }) => mockGameHistoryDock(props),
}));

describe('GameDock', () => {
  beforeEach(() => {
    mockStrengthOrderDock.mockClear();
    mockChatDock.mockClear();
    mockGameHistoryDock.mockClear();
  });

  const mockMatchMedia = (matches: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  };

  it('opens the in-game history dock from the top bar', () => {
    mockMatchMedia(false);

    render(
      <GameDock
        roomId="room-1"
        gameStarted
        currentTrump={null}
        gamePhase="play"
      />,
    );

    expect(screen.getByText('strength dock topbar')).toBeInTheDocument();
    expect(screen.getByText('chat dock topbar')).toBeInTheDocument();
    const historyButton = screen.getByRole('button', { name: 'title' });
    expect(historyButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(historyButton);

    expect(screen.getByText('history dock open')).toBeInTheDocument();
    expect(historyButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('uses a single mobile menu while keeping the chat dock mounted', async () => {
    mockMatchMedia(true);

    render(
      <GameDock
        roomId="room-1"
        gameStarted
        currentTrump={null}
        gamePhase="play"
      />,
    );

    await waitFor(() => {
      expect(mockChatDock).toHaveBeenLastCalledWith(
        expect.objectContaining({ placement: 'menu' }),
      );
    });

    const menuButton = screen.getByRole('button', { name: 'menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('strength dock topbar')).toBeInTheDocument();
    expect(screen.getByText('chat dock menu')).toBeInTheDocument();
  });

  it('includes the leave action in the mobile menu', async () => {
    mockMatchMedia(true);
    const onLeaveRequest = jest.fn();

    render(
      <GameDock
        roomId="room-1"
        gameStarted
        currentTrump={null}
        gamePhase="play"
        onLeaveRequest={onLeaveRequest}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'menu' })).toBeInTheDocument();
    });

    const menuButton = screen.getByRole('button', { name: 'menu' });
    fireEvent.click(menuButton);
    fireEvent.click(screen.getByRole('button', { name: 'leave' }));

    expect(onLeaveRequest).toHaveBeenCalledTimes(1);
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });
});
