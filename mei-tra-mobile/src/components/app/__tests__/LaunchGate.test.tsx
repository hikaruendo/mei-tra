/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Linking, Text } from 'react-native';

import { LaunchGate } from '../LaunchGate';

const mockCheckStoreVersion = jest.fn();
const mockReloadAsync = jest.fn();
let mockUpdatesState = {
  isStartupProcedureRunning: false,
  isDownloading: false,
  isUpdatePending: false,
  restartCount: 0,
  downloadProgress: undefined as number | undefined,
};
let mockLifecycleListener:
  | ((snapshot: { appState: string }, previous: { appState: string }) => void)
  | null = null;

jest.mock('expo-updates', () => ({
  isEnabled: true,
  useUpdates: () => mockUpdatesState,
  reloadAsync: () => mockReloadAsync(),
}));
jest.mock('@/lib/app-version', () => ({
  checkStoreVersion: (platform: string) => mockCheckStoreVersion(platform),
  getStoreUrl: () => 'https://apps.apple.com/app/id123',
}));
jest.mock('@/lib/app-lifecycle', () => ({
  subscribeAppLifecycle: (listener: typeof mockLifecycleListener) => {
    mockLifecycleListener = listener;
    return () => {
      mockLifecycleListener = null;
    };
  },
}));
jest.mock('@/components/ui/BrandHeader', () => ({ BrandHeader: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

interface TreeNode {
  props: Record<string, any>;
}
interface Tree {
  root: {
    findAllByType: (type: unknown) => TreeNode[];
    findAllByProps: (props: Record<string, unknown>) => TreeNode[];
  };
  update: (element: React.ReactElement) => void;
  unmount: () => void;
}

const { act, create } = require('react-test-renderer') as {
  act: (callback: () => unknown) => Promise<void>;
  create: (element: React.ReactElement) => Tree;
};

const gate = (
  <LaunchGate>
    <Text>top</Text>
  </LaunchGate>
);

const mounted: Tree[] = [];

const renderGate = async () => {
  let tree!: Tree;
  await act(async () => {
    tree = create(gate);
  });
  mounted.push(tree);
  return tree;
};

const rerender = async (tree: Tree) => {
  await act(async () => {
    tree.update(gate);
  });
};

const returnToForeground = async () => {
  await act(async () => {
    mockLifecycleListener?.({ appState: 'active' }, { appState: 'background' });
  });
};

const texts = (tree: Tree) =>
  tree.root.findAllByType(Text).map((node) => node.props.children);

let openURL: jest.SpyInstance;

beforeEach(() => {
  mockCheckStoreVersion.mockReset().mockResolvedValue('current');
  mockReloadAsync.mockReset().mockResolvedValue(undefined);
  mockUpdatesState = {
    isStartupProcedureRunning: false,
    isDownloading: false,
    isUpdatePending: false,
    restartCount: 0,
    downloadProgress: undefined,
  };
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(async () => {
  // Unmounting clears the gate's launch timers, which would otherwise fire after Jest finishes.
  await act(async () => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
  openURL.mockRestore();
  jest.useRealTimers();
});

it('opens the top page once the build and data are current', async () => {
  expect(texts(await renderGate())).toEqual(['top']);
});

it('opens the top page on a cold start when the minimum cannot be read', async () => {
  mockCheckStoreVersion.mockResolvedValue('unknown');

  expect(texts(await renderGate())).toEqual(['top']);
});

it('shows download progress instead of the top page', async () => {
  mockUpdatesState = {
    ...mockUpdatesState,
    isStartupProcedureRunning: true,
    isDownloading: true,
    downloadProgress: 0.42,
  };

  const tree = await renderGate();

  expect(texts(tree)).not.toContain('top');
  expect(texts(tree)).toContain('最新データをダウンロードしています… 42%');
});

it('restarts into the downloaded data before the top page', async () => {
  mockUpdatesState = { ...mockUpdatesState, isUpdatePending: true };

  const tree = await renderGate();

  expect(mockReloadAsync).toHaveBeenCalledTimes(1);
  expect(texts(tree)).not.toContain('top');
});

it('opens the top page when the launch check takes too long', async () => {
  jest.useFakeTimers();
  mockUpdatesState = { ...mockUpdatesState, isStartupProcedureRunning: true };

  const tree = await renderGate();
  expect(texts(tree)).not.toContain('top');

  await act(async () => {
    jest.advanceTimersByTime(8000);
  });
  expect(texts(tree)).toEqual(['top']);
});

it('sends an outdated build to the store', async () => {
  mockCheckStoreVersion.mockResolvedValue('outdated');

  const tree = await renderGate();

  expect(texts(tree)).not.toContain('top');
  const [button] = tree.root.findAllByProps({ accessibilityRole: 'button' });
  void act(() => button.props.onPress());
  expect(openURL).toHaveBeenCalledWith('https://apps.apple.com/app/id123');
});

it('blocks on return to the foreground and stays blocked while offline', async () => {
  const tree = await renderGate();
  expect(texts(tree)).toEqual(['top']);

  mockCheckStoreVersion.mockResolvedValue('outdated');
  await returnToForeground();
  expect(texts(tree)).not.toContain('top');

  mockCheckStoreVersion.mockResolvedValue('unknown');
  await returnToForeground();
  expect(texts(tree)).not.toContain('top');
});

it('never restarts a running session for new data', async () => {
  const tree = await renderGate();
  expect(texts(tree)).toEqual(['top']);

  mockUpdatesState = { ...mockUpdatesState, isUpdatePending: true };
  await returnToForeground();
  await rerender(tree);

  expect(mockReloadAsync).not.toHaveBeenCalled();
  expect(texts(tree)).toEqual(['top']);
});
