import { asSeatId } from '@meitra/contracts/ids';
import { StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { PlayerSeat } from '../PlayerSeat';

describe('PlayerSeat', () => {
  it('uses the sized seat itself as the host action target', async () => {
    const onLongPress = jest.fn();
    let renderer!: {
      root: {
        findByProps: (props: Record<string, unknown>) => {
          props: { onLongPress: () => void; style?: unknown };
        };
      };
      unmount: () => void;
    };

    await act(async () => {
      renderer = TestRenderer.create(
        <PlayerSeat
          isTurn={false}
          onLongPress={onLongPress}
          player={{
            socketId: 'socket-2',
            seatId: asSeatId('player-2'),
            userId: 'user-2',
            name: 'Player 2',
            team: 1,
            hand: [],
            isHost: false,
            isCOM: false,
            hasRequiredBroken: false,
          }}
        />,
      ) as unknown as typeof renderer;
    });

    const actionTarget = renderer.root.findByProps({
      accessibilityRole: 'button',
    });
    expect(StyleSheet.flatten(actionTarget.props.style)).toMatchObject({
      flex: 1,
      maxWidth: 110,
    });
    await act(async () => actionTarget.props.onLongPress());
    expect(onLongPress).toHaveBeenCalledTimes(1);

    await act(async () => renderer.unmount());
  });
});
