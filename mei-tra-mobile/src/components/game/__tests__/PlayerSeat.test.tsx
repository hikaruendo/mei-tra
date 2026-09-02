import { asSeatId } from '@meitra/contracts/ids';
import React from 'react';
import { StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { PlayerSeat } from '../PlayerSeat';

jest.mock('@/components/game/PlayerAvatar', () => ({
  PlayerAvatar: () => null,
}));
jest.mock('@/components/game/DealtCard', () => ({
  DealtCard: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/game/PlayingCard', () => ({
  PlayingCard: () => null,
}));
jest.mock('@/components/game/TurnClock', () => ({
  TurnClock: () => null,
}));

describe('PlayerSeat layout', () => {
  it('keeps the player info at its intrinsic height inside an opponent slot', async () => {
    let renderer!: {
      root: {
        findByProps: (props: Record<string, unknown>) => {
          props: { style?: unknown };
        };
      };
      unmount: () => void;
    };

    await act(async () => {
      renderer = TestRenderer.create(
        <PlayerSeat
          isTurn={false}
          player={{
            socketId: 'socket-2',
            seatId: asSeatId('seat-2'),
            name: 'COM',
            team: 1,
            hand: ['S-3', 'H-4'],
            isHost: false,
            isCOM: true,
            hasRequiredBroken: false,
          }}
          teamFieldCounts={{ 0: 0, 1: 5 }}
        />,
      ) as unknown as typeof renderer;
    });

    const seat = renderer.root.findByProps({ testID: 'player-seat-seat-2' });
    expect(StyleSheet.flatten(seat.props.style)).toMatchObject({
      width: '100%',
      flexGrow: 0,
    });

    await act(async () => renderer.unmount());
  });
});
