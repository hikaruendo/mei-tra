/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Linking, Text } from 'react-native';

import { LaunchGate } from '../LaunchGate';

const mockFetchMinimumVersion = jest.fn();
const mockInstallLatestBundle = jest.fn();
let mockLifecycleListener:
  | ((snapshot: { appState: string }, previous: { appState: string }) => void)
  | null = null;

jest.mock('expo-updates', () => ({ useUpdates: () => ({ downloadProgress: 0.42 }) }));
jest.mock('@/lib/app-version', () => ({
  ...jest.requireActual('@/lib/app-version'),
  fetchMinimumVersion: (platform: string) => mockFetchMinimumVersion(platform),
  getInstalledVersion: () => '0.1.2',
}));
jest.mock('@/lib/ota-update', () => ({
  installLatestBundle: (onDownloadStart: () => void) =>
    mockInstallLatestBundle(onDownloadStart),
}));
jest.mock('@/lib/app-lifecycle', () => ({
  subscribeAppLifecycle: (listener: typeof mockLifecycleListener) => {
    mockLifecycleListener = listener;
    return () => {
      mockLifecycleListener = null;
    };
  },
}));
jest.mock('@/lib/config', () => ({
  config: { publicWebBaseUrl: 'https://web.example' },
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
}

const { act, create } = require('react-test-renderer') as {
  act: (callback: () => unknown) => Promise<void>;
  create: (element: React.ReactElement) => Tree;
};

const renderGate = async () => {
  let tree!: Tree;
  await act(async () => {
    tree = create(
      <LaunchGate>
        <Text>top</Text>
      </LaunchGate>,
    );
  });
  return tree;
};

const texts = (tree: Tree) =>
  tree.root.findAllByType(Text).map((node) => node.props.children);

let openURL: jest.SpyInstance;

beforeEach(() => {
  mockFetchMinimumVersion.mockReset().mockResolvedValue('0.1.2');
  mockInstallLatestBundle.mockReset().mockResolvedValue('up-to-date');
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  openURL.mockRestore();
});

it('opens the top page once the build and data are current', async () => {
  expect(texts(await renderGate())).toEqual(['top']);
});

it('opens the top page when the minimum version cannot be read', async () => {
  mockFetchMinimumVersion.mockResolvedValue(null);

  expect(texts(await renderGate())).toEqual(['top']);
});

it('shows download progress instead of the top page while new data arrives', async () => {
  mockInstallLatestBundle.mockImplementation((onDownloadStart: () => void) => {
    onDownloadStart();
    return new Promise(() => {});
  });

  const tree = await renderGate();

  expect(texts(tree)).not.toContain('top');
  expect(texts(tree)).toContain('最新データをダウンロードしています… 42%');
});

it('sends an outdated build to the store without downloading data', async () => {
  mockFetchMinimumVersion.mockResolvedValue('0.1.3');

  const tree = await renderGate();

  expect(texts(tree)).not.toContain('top');
  expect(mockInstallLatestBundle).not.toHaveBeenCalled();
  const [button] = tree.root.findAllByProps({ accessibilityRole: 'button' });
  void act(() => button.props.onPress());
  expect(openURL).toHaveBeenCalledWith(
    expect.stringMatching(/^https:\/\/(apps\.apple\.com|play\.google\.com)\//),
  );
});

it('checks again on return to the foreground', async () => {
  const tree = await renderGate();
  expect(texts(tree)).toEqual(['top']);

  mockFetchMinimumVersion.mockResolvedValue('0.1.3');
  await act(async () => {
    mockLifecycleListener?.({ appState: 'active' }, { appState: 'background' });
  });

  expect(texts(tree)).not.toContain('top');
});
