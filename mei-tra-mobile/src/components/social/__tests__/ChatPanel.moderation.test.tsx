import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ChatPanel } from '../ChatPanel';

const mockReportMessage = jest.fn();
const mockBlockUser = jest.fn();
const mockUnblockUser = jest.fn();
const mockJoinRoom = jest.fn();
const mockLeaveRoom = jest.fn();
const mockUseSocial = jest.fn();

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me' } }),
}));
jest.mock('@/context/SocialContext', () => ({
  useSocial: () => mockUseSocial(),
}));
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const ReactModule = jest.requireActual<typeof React>('react');
  const MockFlatList = ReactModule.forwardRef(({ data, renderItem }: {
    data: unknown[]; renderItem: (item: { item: unknown; index: number }) => React.ReactNode;
  }, ref: React.Ref<unknown>) => {
    ReactModule.useImperativeHandle(ref, () => ({ scrollToEnd: jest.fn() }));
    return ReactModule.createElement(ReactModule.Fragment, null,
      data.map((item, index) => ReactModule.createElement(ReactModule.Fragment,
        { key: index }, renderItem({ item, index }))));
  });
  return { __esModule: true, default: MockFlatList };
});

interface Renderer {
  root: {
    findAllByProps: (props: Record<string, unknown>) => {
      type: unknown;
      props: { onPress?: () => void };
    }[];
  };
  unmount: () => void;
}

describe('ChatPanel moderation controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSocial.mockReturnValue({
      connected: true,
      messages: [{
        id: 'message-1', roomId: 'room-1',
        sender: { userId: 'other', displayName: 'Opponent', rankTier: 'bronze' },
        content: 'text', contentType: 'text', createdAt: new Date().toISOString(),
      }],
      blockedUsers: [],
      notice: null,
      typingUserIds: [],
      joinRoom: mockJoinRoom,
      leaveRoom: mockLeaveRoom,
      sendMessage: jest.fn(),
      sendTyping: jest.fn(),
      reportMessage: mockReportMessage,
      blockUser: mockBlockUser,
      unblockUser: mockUnblockUser,
    });
  });

  it('offers report and block on another player’s message', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    let renderer!: Renderer;
    await act(async () => { renderer = TestRenderer.create(<ChatPanel roomId="room-1" />) as unknown as Renderer; });
    const actions = renderer.root.findAllByProps({ accessibilityRole: 'button' })
      .filter((node) => typeof node.props.onPress === 'function' &&
        typeof node.type === 'function' && node.type.name === 'Pressable');
    expect(actions).toHaveLength(2);
    await act(async () => actions[0].props.onPress?.());
    const reportChoices = alert.mock.calls[0][2];
    reportChoices?.[1]?.onPress?.();
    expect(mockReportMessage).toHaveBeenCalledWith('room-1', 'message-1');
    await act(async () => actions[1].props.onPress?.());
    const blockChoices = alert.mock.calls[1][2];
    blockChoices?.[1]?.onPress?.();
    expect(mockBlockUser).toHaveBeenCalledWith('other');
    await act(async () => renderer.unmount());
    alert.mockRestore();
  });
});
