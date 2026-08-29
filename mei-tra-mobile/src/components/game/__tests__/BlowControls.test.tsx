import { asSeatId } from '@meitra/contracts/ids';
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
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
});
