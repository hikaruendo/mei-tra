import { asSeatId } from '@meitra/contracts/ids';
import type { RoomContract, RoomPlayerContract } from '@meitra/contracts/room';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import RoomsScreen from '../rooms';

const mockPush = jest.fn();
const mockButtons: { label: string; onPress: () => unknown }[] = [];
let mockGame: Record<string, unknown>;

jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ push: mockPush }),
  // Runs the callback as if the screen were focused, and again when it changes.
  useFocusEffect: (callback: () => void) => {
    const { useEffect: mockUseEffect } = jest.requireActual('react');
    mockUseEffect(() => callback(), [callback]);
  },
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'player@example.com', profile: null },
    loading: false,
  }),
}));

jest.mock('@/context/GameContext', () => ({
  useGame: () => mockGame,
}));

jest.mock('@/context/LocaleContext', () => ({
  useLocale: jest.fn(),
}));

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@/components/ui/BrandHeader', () => ({
  BrandHeader: () => null,
}));

jest.mock('@/components/ui/ConnectionBanner', () => ({
  ConnectionBanner: () => null,
}));

jest.mock('@/components/ui/FeedbackBanner', () => ({
  FeedbackBanner: () => null,
}));

jest.mock('@/components/ui/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({
    children,
    onPress,
  }: {
    children: string;
    onPress: () => unknown;
  }) => {
    mockButtons.push({ label: children, onPress });
    return null;
  },
}));

const roomPlayer = (
  overrides: Partial<RoomPlayerContract> = {},
): RoomPlayerContract => ({
  socketId: 'socket-1',
  seatId: asSeatId('seat-1'),
  userId: 'user-1',
  name: 'Player 1',
  team: 0,
  hand: [],
  isHost: true,
  isCOM: false,
  hasRequiredBroken: false,
  isReady: true,
  joinedAt: '2026-09-18T00:00:00.000Z',
  ...overrides,
});

const playingRoom = (id: string): RoomContract => ({
  id,
  name: `Room ${id}`,
  hostSeatId: asSeatId('seat-1'),
  status: 'playing',
  players: [
    roomPlayer(),
    roomPlayer({ seatId: asSeatId('seat-2'), userId: undefined, isCOM: true }),
  ],
  settings: {
    maxPlayers: 4,
    isPrivate: false,
    password: null,
    teamAssignmentMethod: 'random',
    pointsToWin: 5,
    allowSpectators: true,
  },
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
  lastActivityAt: '2026-09-18T00:00:00.000Z',
});

const labels = () => mockButtons.map((button) => button.label);
const count = (label: string) =>
  labels().filter((candidate) => candidate === label).length;

const render = async () => {
  mockButtons.length = 0;
  await act(async () => {
    TestRenderer.create(<RoomsScreen />);
  });
};

describe('RoomsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGame = {
      rooms: [playingRoom('room-1'), playingRoom('room-2')],
      currentRoom: null,
      game: null,
      connectionStatus: 'connected',
      error: null,
      notice: null,
      recoveryNotice: null,
      refreshRooms: jest.fn(),
      createRoom: jest.fn().mockResolvedValue(true),
      joinRoom: jest.fn().mockResolvedValue(true),
      watchRoom: jest.fn().mockResolvedValue(true),
      clearFeedback: jest.fn(),
    };
  });

  it('offers join and watch for every playing room when the player is in none', async () => {
    await render();

    expect(mockPush).not.toHaveBeenCalled();
    expect(count('rooms.join')).toBe(2);
    expect(count('rooms.watch')).toBe(2);
  });

  it('opens the room the server has put the player in', async () => {
    mockGame.currentRoom = playingRoom('room-1');

    await render();

    expect(mockPush).toHaveBeenCalledWith('/room/current');
    // The player's own room offers neither; the other room still does.
    expect(count('rooms.join')).toBe(1);
    expect(count('rooms.watch')).toBe(1);
  });

  it('opens a restored game even before the room itself arrives', async () => {
    mockGame.game = { roomId: 'room-2', isSpectator: false };

    await render();

    expect(mockPush).toHaveBeenCalledWith('/room/current');
    expect(count('rooms.watch')).toBe(1);
  });

  it('leaves navigation to the room state after watching', async () => {
    await render();
    const watch = mockButtons.find((button) => button.label === 'rooms.watch');

    await act(async () => {
      await watch!.onPress();
    });

    expect(mockGame.watchRoom).toHaveBeenCalledWith('room-1');
    // The screen moves only once the context reports the room.
    expect(mockPush).not.toHaveBeenCalled();
  });
});
