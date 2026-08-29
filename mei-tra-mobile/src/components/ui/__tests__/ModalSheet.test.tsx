import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { ModalSheet } from '../ModalSheet';

interface RendererHandle {
  root: {
    findByProps: (props: Record<string, unknown>) => {
      props: { style?: StyleProp<ViewStyle> };
    };
    findByType: (type: unknown) => {
      props: { onRequestClose: () => void };
    };
  };
  toJSON: () => unknown;
}

describe('ModalSheet', () => {
  it('renders the shared sheet and delegates the native close request', () => {
    const onClose = jest.fn();
    let renderer!: RendererHandle;

    act(() => {
      renderer = TestRenderer.create(
        <ModalSheet
          closeLabel="Close"
          onClose={onClose}
          testID="test-sheet"
          title="Chat"
          visible
        >
          <Text>Messages</Text>
        </ModalSheet>,
      ) as unknown as RendererHandle;
    });

    expect(renderer.root.findByProps({ testID: 'test-sheet' })).toBeDefined();
    expect(JSON.stringify(renderer.toJSON())).toContain('Messages');
    expect(
      StyleSheet.flatten(
        renderer.root.findByProps({ testID: 'modal-sheet-close' }).props.style,
      ),
    ).toMatchObject({ minHeight: 44 });

    act(() => renderer.root.findByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
