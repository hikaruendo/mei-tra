import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import RoomScreen from '../room/[roomId]';

let mockGame: Record<string, unknown>;

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
  useLocalSearchParams: () => ({ roomId: 'current' }),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', isAnonymous: false }, loading: false }),
}));
jest.mock('@/context/GameContext', () => ({ useGame: () => mockGame }));
jest.mock('@/context/LocaleContext', () => ({ useLocale: jest.fn() }));
jest.mock('@/hooks/useGameKeepAwake', () => ({ useGameKeepAwake: jest.fn() }));
jest.mock('@/hooks/useGameHistory', () => ({ useGameHistory: () => null }));
jest.mock('@/i18n', () => ({ t: (key: string) => key }));
jest.mock('@/components/game/GameBoard', () => ({ GameBoard: () => {
  const { Text } = jest.requireActual('react-native');
  return <Text>game board</Text>;
} }));
jest.mock('@/components/game/GameResultExperience', () => ({
  GameResultExperience: () => {
    const { Text } = jest.requireActual('react-native');
    return <Text>game result</Text>;
  },
}));
jest.mock('@/components/game/WaitingRoom', () => ({ WaitingRoom: () => {
  const { Text } = jest.requireActual('react-native');
  return <Text>waiting room</Text>;
} }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/ui/ScreenTapBoundary', () => ({
  ScreenTapBoundary: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/ui/ConnectionBanner', () => ({ ConnectionBanner: () => null }));
jest.mock('@/components/ui/FeedbackBanner', () => ({ FeedbackBanner: () => null }));
jest.mock('@/components/ui/Button', () => ({ Button: ({ children }: { children: React.ReactNode }) => {
  const { Text } = jest.requireActual('react-native');
  return <Text>{children}</Text>;
} }));

type Renderer = {
  root: {
    findAllByType: (type: typeof Text) => { props: { children: React.ReactNode } }[];
  };
  update: (element: React.ReactElement) => void;
};

const labels = (renderer: Renderer) =>
  renderer.root.findAllByType(Text).map((node) => node.props.children);

describe('RoomScreen after a finished spectator game', () => {
  beforeEach(() => {
    mockGame = {
      currentRoom: null,
      game: { roomId: 'room-1', gamePhase: 'play', isSpectator: true },
      connectionStatus: 'connected',
      currentSeatId: null,
      gameResult: null,
      error: null,
      notice: null,
      recoveryNotice: null,
    };
  });

  it('returns to rooms after back-to-lobby clears the watched game', async () => {
    let renderer!: Renderer;
    await act(async () => {
      renderer = TestRenderer.create(<RoomScreen />) as unknown as Renderer;
    });
    expect(labels(renderer)).toContain('game board');

    mockGame = { ...mockGame, game: null };
    await act(async () => {
      renderer.update(<RoomScreen />);
    });

    expect(labels(renderer)).toContain('redirect:/rooms');
    expect(labels(renderer)).not.toContain('room.restoring');
  });

  it("keeps a finished game's result visible after the room closes", async () => {
    let renderer!: Renderer;
    await act(async () => {
      renderer = TestRenderer.create(<RoomScreen />) as unknown as Renderer;
    });

    mockGame = { ...mockGame, game: null, gameResult: { token: 1 } };
    await act(async () => {
      renderer.update(<RoomScreen />);
    });

    expect(labels(renderer)).toContain('game result');
    expect(labels(renderer)).not.toContain('redirect:/rooms');
  });

  it('still waits while an initial room restoration has not completed', async () => {
    mockGame = { ...mockGame, game: null };
    let renderer!: Renderer;
    await act(async () => {
      renderer = TestRenderer.create(<RoomScreen />) as unknown as Renderer;
    });

    expect(labels(renderer)).not.toContain('redirect:/rooms');
    expect(labels(renderer)).toContain('room.restoring');
  });
});
