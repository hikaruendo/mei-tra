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

jest.mock('@/components/game/StrengthOrderDock', () => ({
  StrengthOrderDock: (props: { placement?: string }) => mockStrengthOrderDock(props),
}));

jest.mock('@/components/social/ChatDock', () => ({
  ChatDock: (props: { placement?: string }) => mockChatDock(props),
}));

describe('GameDock', () => {
  beforeEach(() => {
    mockStrengthOrderDock.mockClear();
    mockChatDock.mockClear();
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

  it('renders gameplay utility docks without the in-game history dock', () => {
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
    expect(screen.queryByText('Replay Log')).not.toBeInTheDocument();
    expect(screen.queryByText('対局ログ')).not.toBeInTheDocument();
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
});
