import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { useGameKeepAwake } from '../useGameKeepAwake';

const mockActivateKeepAwakeAsync = jest.fn<Promise<void>, [string]>();
const mockDeactivateKeepAwake = jest.fn<Promise<void>, [string]>();

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: (tag: string) => mockActivateKeepAwakeAsync(tag),
  deactivateKeepAwake: (tag: string) => mockDeactivateKeepAwake(tag),
}));

function KeepAwakeProbe() {
  useGameKeepAwake();
  return null;
}

describe('useGameKeepAwake', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeactivateKeepAwake.mockResolvedValue(undefined);
  });

  it('waits for activation before releasing a wake lock after unmount', async () => {
    let resolveActivation: (() => void) | undefined;
    mockActivateKeepAwakeAsync.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveActivation = resolve;
        }),
    );
    let renderer: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(<KeepAwakeProbe />);
    });
    const tag = mockActivateKeepAwakeAsync.mock.calls[0][0];

    await act(async () => {
      renderer.unmount();
    });
    expect(mockDeactivateKeepAwake).not.toHaveBeenCalled();

    await act(async () => {
      resolveActivation?.();
      await Promise.resolve();
    });
    expect(mockDeactivateKeepAwake).toHaveBeenCalledTimes(1);
    expect(mockDeactivateKeepAwake).toHaveBeenCalledWith(tag);
  });
});
