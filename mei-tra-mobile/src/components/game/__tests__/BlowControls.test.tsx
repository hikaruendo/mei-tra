import type { BlowActionContract } from '@meitra/contracts/game';
import { asSeatId } from '@meitra/contracts/ids';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { BlowControls } from '../BlowControls';

const player = {
  socketId: 'socket-1',
  seatId: asSeatId('seat-1'),
  userId: 'user-1',
  name: 'Player 1',
  team: 0 as const,
  hand: [],
  isCOM: false,
};

interface RendererHandle {
  root: {
    findByProps: (props: Record<string, unknown>) => {
      props: { onPress: () => void; style: StyleProp<ViewStyle> };
    };
  };
}

describe('BlowControls', () => {
  afterEach(() => jest.useRealTimers());

  it('shows every trump option in a wrapping grid without horizontal scrolling', () => {
    let renderer!: RendererHandle;

    act(() => {
      renderer = TestRenderer.create(
        <BlowControls
          actionHistory={[]}
          currentSeatId={player.seatId}
          currentTurn={player.seatId}
          highest={null}
          onDeclare={jest.fn()}
          onPass={jest.fn()}
          players={[player]}
        />,
      ) as unknown as RendererHandle;
    });

    const options = renderer.root.findByProps({
      testID: 'blow-trump-options',
    });
    expect(StyleSheet.flatten(options.props.style)).toMatchObject({
      flexDirection: 'row',
      flexWrap: 'wrap',
    });

    const optionWidths = ['zuppe', 'club', 'daiya', 'herz', 'tra'].map(
      (trump) => {
        const option = renderer.root.findByProps({
          testID: `blow-trump-${trump}`,
        });
        return StyleSheet.flatten(option.props.style).width;
      },
    );
    expect(optionWidths).toEqual(Array(5).fill('30%'));
  });

  it('preserves declare and pass actions inside the glass surface', () => {
    jest.useFakeTimers();
    const onDeclare = jest.fn();
    const onPass = jest.fn();
    let renderer!: RendererHandle;

    act(() => {
      renderer = TestRenderer.create(
        <BlowControls
          actionHistory={[]}
          currentSeatId={player.seatId}
          currentTurn={player.seatId}
          highest={null}
          onDeclare={onDeclare}
          onPass={onPass}
          players={[player]}
        />,
      ) as unknown as RendererHandle;
    });

    expect(
      renderer.root.findByProps({ testID: 'blow-controls-surface' }),
    ).toBeDefined();

    act(() => {
      renderer.root.findByProps({ testID: 'blow-trump-zuppe' }).props.onPress();
      renderer.root.findByProps({ testID: 'blow-pairs-6' }).props.onPress();
    });
    act(() => {
      renderer.root.findByProps({ testID: 'blow-declare' }).props.onPress();
    });
    expect(onDeclare).toHaveBeenCalledWith('zuppe', 6);

    act(() => jest.advanceTimersByTime(1800));
    act(() => {
      renderer.root.findByProps({ testID: 'blow-pass' }).props.onPress();
    });
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it("shows every player's blow action in the history without scrolling it", () => {
    const players = [1, 2, 3, 4].map((n) => ({
      ...player,
      socketId: `socket-${n}`,
      seatId: asSeatId(`seat-${n}`),
      userId: `user-${n}`,
      name: `Player ${n}`,
      team: (n % 2) as 0 | 1,
    }));
    const [first, second, third, fourth] = players.map(
      (candidate) => candidate.seatId,
    );
    // Each player declares or passes once in a blow phase.
    const actionHistory: BlowActionContract[] = [
      { type: 'declare', seatId: first, trumpType: 'zuppe', numberOfPairs: 6, timestamp: 1 },
      { type: 'pass', seatId: second, timestamp: 2 },
      { type: 'declare', seatId: third, trumpType: 'club', numberOfPairs: 6, timestamp: 3 },
      { type: 'declare', seatId: fourth, trumpType: 'herz', numberOfPairs: 7, timestamp: 4 },
    ];
    let renderer!: {
      root: {
        findAllByType: (
          type: typeof ScrollView,
        ) => { props: { horizontal?: boolean } }[];
        findByProps: (props: Record<string, unknown>) => {
          findAll: (
            predicate: (node: {
              type: unknown;
              props: Record<string, unknown>;
            }) => boolean,
          ) => unknown[];
        };
      };
    };

    act(() => {
      renderer = TestRenderer.create(
        <BlowControls
          actionHistory={actionHistory}
          currentSeatId={second}
          currentTurn={second}
          highest={{
            seatId: fourth,
            trumpType: 'herz',
            numberOfPairs: 7,
            timestamp: 4,
          }}
          onDeclare={jest.fn()}
          onPass={jest.fn()}
          players={players}
        />,
      ) as unknown as typeof renderer;
    });

    const entries = renderer.root
      .findByProps({ testID: 'blow-history' })
      .findAll(
        (node) =>
          typeof node.type !== 'string' &&
          node.props.testID === 'blow-history-entry',
      );
    expect(entries).toHaveLength(actionHistory.length);
    // Only the row of pair counts scrolls, and it scrolls sideways.
    expect(
      renderer.root
        .findAllByType(ScrollView)
        .map((view) => Boolean(view.props.horizontal)),
    ).toEqual([true]);
  });
});
