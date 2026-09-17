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

  it('marks a disconnected seat with a border and a label, not by fading it', async () => {
    let renderer!: {
      root: {
        findByProps: (props: Record<string, unknown>) => {
          props: { style?: unknown };
        };
        findAllByProps: (props: Record<string, unknown>) => unknown[];
      };
      unmount: () => void;
    };

    await act(async () => {
      renderer = TestRenderer.create(
        <PlayerSeat
          isDisconnected
          isTurn={false}
          player={{
            socketId: 'socket-2',
            seatId: asSeatId('seat-2'),
            name: 'Player 2',
            team: 1,
            hand: ['S-3'],
            isHost: false,
            isCOM: false,
            hasRequiredBroken: false,
          }}
        />,
      ) as unknown as typeof renderer;
    });

    const seatStyle = StyleSheet.flatten(
      renderer.root.findByProps({ testID: 'player-seat-seat-2' }).props.style,
    ) as { opacity?: number; borderWidth?: number };
    expect(seatStyle.opacity).toBeUndefined();
    expect(seatStyle.borderWidth).toBe(2);
    expect(renderer.root.findAllByProps({ children: '切断中' })).not.toHaveLength(0);

    await act(async () => renderer.unmount());
  });

  it('shows a revealed hand face up', async () => {
    const hand = ['2♠', '3♠', '4♠', '5♠', '6♠', '7♠', '8♠', '9♠', '10♠', 'Q♠'];
    let renderer!: {
      root: {
        findAllByProps: (props: Record<string, unknown>) => unknown[];
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
            name: 'Player 2',
            team: 1,
            hand,
            isHost: false,
            isCOM: false,
            hasRequiredBroken: false,
          }}
          revealedHand={hand}
        />,
      ) as unknown as typeof renderer;
    });

    expect(renderer.root.findAllByProps({ faceDown: true })).toHaveLength(0);
    for (const card of hand) {
      expect(renderer.root.findAllByProps({ card })).toHaveLength(1);
    }

    await act(async () => renderer.unmount());
  });
});
