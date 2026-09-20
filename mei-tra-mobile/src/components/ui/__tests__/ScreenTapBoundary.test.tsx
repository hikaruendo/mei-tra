import React from 'react';
import { Platform, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ScreenTapBoundary, useScreenTapDismiss, useScreenTapProtection } from '../ScreenTapBoundary';

it('waits for React capture on web, protects selected-card clicks, and dismisses outside clicks', async () => {
  jest.useFakeTimers();
  jest.replaceProperty(Platform, 'OS', 'web');
  const dismiss = jest.fn();
  const addEventListener = jest.fn();
  const removeEventListener = jest.fn();
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true, value: { addEventListener, removeEventListener },
  });
  function Selection() {
    useScreenTapDismiss(dismiss);
    return <View {...useScreenTapProtection()} testID="protected-selection" />;
  }
  let renderer!: {
    root: { findByProps: (props: Record<string, unknown>) => { props: { onClickCapture: () => void } } };
    unmount: () => void;
  };
  try {
    await act(async () => {
      renderer = TestRenderer.create(<ScreenTapBoundary><Selection /></ScreenTapBoundary>) as unknown as typeof renderer;
    });
    const capture = addEventListener.mock.calls.find(([name]) => name === 'click')?.[1] as () => void;
    expect(addEventListener).toHaveBeenCalledWith('click', expect.any(Function), true);
    await act(async () => {
      capture();
      // The browser can run a microtask checkpoint before React receives the
      // native click. It must not clear selection ahead of its protection.
      await Promise.resolve();
      expect(dismiss).not.toHaveBeenCalled();
      renderer.root.findByProps({ testID: 'protected-selection' }).props.onClickCapture();
      jest.runOnlyPendingTimers();
    });
    expect(dismiss).not.toHaveBeenCalled();
    await act(async () => { capture(); jest.runOnlyPendingTimers(); });
    expect(dismiss).toHaveBeenCalledTimes(1);
    await act(async () => renderer.unmount());
    expect(removeEventListener).toHaveBeenCalledWith('click', capture, true);
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    jest.restoreAllMocks();
    jest.useRealTimers();
  }
});
