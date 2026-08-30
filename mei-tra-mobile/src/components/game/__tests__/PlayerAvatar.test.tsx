import { asSeatId } from '@meitra/contracts/ids';
import type { UserProfileDto } from '@meitra/contracts/profile';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { fetchPlayerProfile } from '@/lib/profile-api';
import type { MobilePlayer } from '@/types/game';

import { PlayerAvatar } from '../PlayerAvatar';

jest.mock('@/lib/profile-api', () => ({
  fetchPlayerProfile: jest.fn(),
}));

const mockFetchPlayerProfile = fetchPlayerProfile as jest.MockedFunction<
  typeof fetchPlayerProfile
>;

const player = (overrides: Partial<MobilePlayer> = {}): MobilePlayer => ({
  socketId: 'socket-1',
  seatId: asSeatId('seat-1'),
  userId: 'user-1',
  name: 'Player',
  team: 0,
  hand: [],
  isAuthenticated: true,
  isCOM: false,
  ...overrides,
});

const profile = (avatarUrl: string): UserProfileDto => ({
  id: 'user-1',
  username: 'player',
  displayName: 'Player',
  avatarUrl,
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
  lastSeenAt: '2026-08-30T00:00:00.000Z',
  gamesPlayed: 0,
  gamesWon: 0,
  totalScore: 0,
  preferences: {
    notifications: true,
    sound: true,
    theme: 'dark',
    fontSize: 'standard',
  },
});

describe('PlayerAvatar', () => {
  beforeEach(() => {
    mockFetchPlayerProfile.mockReset();
  });

  it('renders the profile image and refreshes it after seat reconnection', async () => {
    mockFetchPlayerProfile
      .mockResolvedValueOnce(profile('https://cdn.example.com/first.webp'))
      .mockResolvedValueOnce(
        profile('https://cdn.example.com/reconnected.webp'),
      );

    let renderer!: {
      root: {
        findByProps: (props: Record<string, unknown>) => {
          props: Record<string, unknown>;
        };
      };
      update: (element: React.ReactElement) => void;
      unmount: () => void;
    };
    await act(async () => {
      renderer = TestRenderer.create(
        <PlayerAvatar player={player()} size={32} />,
      ) as unknown as typeof renderer;
      await Promise.resolve();
    });

    expect(
      renderer.root.findByProps({ testID: 'player-avatar-image-seat-1' }).props
        .source,
    ).toEqual({ uri: 'https://cdn.example.com/first.webp' });

    await act(async () => {
      renderer.update(
        <PlayerAvatar
          player={player({ socketId: 'socket-reconnected' })}
          size={32}
        />,
      );
      await Promise.resolve();
    });

    expect(mockFetchPlayerProfile).toHaveBeenCalledTimes(2);
    expect(
      renderer.root.findByProps({ testID: 'player-avatar-image-seat-1' }).props
        .source,
    ).toEqual({ uri: 'https://cdn.example.com/reconnected.webp' });

    await act(async () => renderer.unmount());
  });

  it('does not request a profile for COM seats', async () => {
    let renderer!: {
      root: {
        findByProps: (props: Record<string, unknown>) => unknown;
      };
      unmount: () => void;
    };
    await act(async () => {
      renderer = TestRenderer.create(
        <PlayerAvatar
          player={player({ isCOM: true, userId: undefined })}
          size={32}
        />,
      ) as unknown as typeof renderer;
      await Promise.resolve();
    });

    expect(mockFetchPlayerProfile).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ testID: 'player-avatar-seat-1' })).toBeTruthy();

    await act(async () => renderer.unmount());
  });
});
