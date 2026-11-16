import { asSeatId } from '@meitra/contracts/ids';
import type { RoomContract, RoomPlayerContract } from '@meitra/contracts/room';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput, type ViewStyle } from 'react-native';

import RoomsScreen from '../rooms';
import { palette } from '@/theme/palette';

const mockPush = jest.fn();
const mockButtons: { label: string; onPress: () => unknown; disabled?: boolean; variant?: string; style?: ViewStyle }[] = [];
let mockGame: Record<string, unknown>;
type RoomsRenderer = {
  root: {
    findAllByType: (type: typeof TextInput) => {
      props: { accessibilityLabel?: string; onChangeText: (value: string) => void };
    }[];
    findAllByProps: (props: Record<string, unknown>) => unknown[];
  };
};

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
    disabled,
    variant,
    style,
  }: {
    children: string;
    onPress: () => unknown;
    disabled?: boolean;
    variant?: string;
    style?: ViewStyle;
  }) => {
    mockButtons.push({ label: children, onPress, disabled, variant, style });
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
  let renderer!: RoomsRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<RoomsScreen />) as unknown as RoomsRenderer;
  });
  return renderer;
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

  it('labels the stacked creation and room-list sections', async () => {
    const renderer = await render();

    expect(renderer.root.findAllByProps({ children: 'rooms.createRoom' }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ children: 'rooms.joinable' }).length).toBeGreaterThan(0);
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

  it.each([
    ['rooms.createNormal', 'normal', undefined],
    ['rooms.createPro', 'pro', 'ghost'],
  ])('creates the selected room type via %s', async (label, mode, variant) => {
    const renderer = await render();
    const inputs = renderer.root.findAllByType(TextInput);
    const roomName = inputs.find((input) => input.props.accessibilityLabel === 'rooms.roomName')!;
    const points = inputs.find((input) => input.props.accessibilityLabel === 'rooms.pointsToWin')!;
    act(() => {
      roomName.props.onChangeText(' Test room ');
      points.props.onChangeText('20');
    });
    const button = mockButtons.filter((candidate) => candidate.label === label).slice(-1)[0];
    expect(button?.variant).toBe(variant);

    await act(async () => {
      await button!.onPress();
    });

    expect(mockGame.createRoom).toHaveBeenCalledWith('Test room', 20, mode);
  });

  it('uses distinct bright and dark fills and shows descriptions only when tapped', async () => {
    const renderer = await render();

    const normal = mockButtons.find((button) => button.label === 'rooms.createNormal');
    const pro = mockButtons.find((button) => button.label === 'rooms.createPro');
    expect(normal?.style).toMatchObject({
      backgroundColor: palette.roomCreation.normalBackground,
      borderColor: palette.roomCreation.normalBorder,
    });
    expect(pro?.style).toMatchObject({
      backgroundColor: palette.roomCreation.proBackground,
      borderColor: palette.roomCreation.proBorder,
    });
    expect(renderer.root.findAllByProps({ children: 'rooms.createNormalDescription' })).toHaveLength(0);
    const info = renderer.root.findAllByProps({ accessibilityLabel: 'rooms.createNormal rooms.modeInfo' })[0] as { props: { onPress: () => void } };
    act(() => info.props.onPress());
    expect(renderer.root.findAllByProps({ children: 'rooms.createNormalDescription' }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ children: 'rooms.createProDescription' })).toHaveLength(0);
  });

  it('disables both create actions while a room is being created', async () => {
    let complete!: (value: boolean) => void;
    mockGame.createRoom = jest.fn(() => new Promise<boolean>((resolve) => { complete = resolve; }));
    await render();
    const normal = mockButtons.find((button) => button.label === 'rooms.createNormal')!;
    const pro = mockButtons.find((button) => button.label === 'rooms.createPro')!;

    act(() => {
      void normal.onPress();
      void pro.onPress();
    });
    expect(mockGame.createRoom).toHaveBeenCalledTimes(1);
    expect(mockButtons.filter((button) => button.label.startsWith('rooms.create')).slice(-2).every((button) => button.disabled)).toBe(true);

    await act(async () => { complete(true); });
  });
});
