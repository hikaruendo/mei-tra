import type { MobileRoom } from '@/types/game';
import { asSeatId } from '@meitra/contracts/ids';
import React from 'react';
import { Platform } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { WaitingRoom } from '../WaitingRoom';

jest.mock('@/components/social/ChatPanel', () => ({ ChatPanel: () => null }));

const room: MobileRoom = {
  id: 'room-1',
  name: 'Test room',
  hostSeatId: asSeatId('host'),
  status: 'waiting',
  players: [],
  settings: {
    maxPlayers: 4,
    isPrivate: false,
    password: null,
    teamAssignmentMethod: 'random',
    pointsToWin: 5,
    allowSpectators: true,
  },
  createdAt: '2026-09-26T00:00:00.000Z',
  updatedAt: '2026-09-26T00:00:00.000Z',
  lastActivityAt: '2026-09-26T00:00:00.000Z',
};

const props: React.ComponentProps<typeof WaitingRoom> = {
  room,
  currentSeatId: null,
  isHost: false,
  onShuffle: jest.fn(),
  onStart: jest.fn(),
  onLeave: jest.fn(),
  onRemovePlayer: jest.fn(),
  onReplaceWithCOM: jest.fn(),
  onUpdateTeamNames: jest.fn(),
};

type Renderer = {
  toJSON: () => unknown;
  root: { findAllByProps: (props: Record<string, unknown>) => unknown[] };
  unmount: () => void;
};

describe('WaitingRoom iOS launch', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('keeps the chat entry and sheet on both iOS and Android', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    let ios!: Renderer;
    await act(async () => { ios = TestRenderer.create(<WaitingRoom {...props} />) as unknown as Renderer; });
    expect(JSON.stringify(ios.toJSON())).toContain('チャット');
    expect(ios.root.findAllByProps({ testID: 'waiting-chat-sheet' })).toHaveLength(1);
    await act(async () => ios.unmount());

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    let android!: Renderer;
    await act(async () => { android = TestRenderer.create(<WaitingRoom {...props} />) as unknown as Renderer; });
    expect(JSON.stringify(android.toJSON())).toContain('チャット');
    expect(android.root.findAllByProps({ testID: 'waiting-chat-sheet' })).toHaveLength(1);
    await act(async () => android.unmount());
  });
});
