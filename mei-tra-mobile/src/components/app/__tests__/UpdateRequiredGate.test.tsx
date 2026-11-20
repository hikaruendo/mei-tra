/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Linking, Text } from 'react-native';

import { UpdateRequiredGate } from '../UpdateRequiredGate';

const mockFetchMinimumVersion = jest.fn();
let mockLifecycleListener:
  | ((snapshot: { appState: string }, previous: { appState: string }) => void)
  | null = null;

jest.mock('@/lib/app-version', () => ({
  ...jest.requireActual('@/lib/app-version'),
  fetchMinimumVersion: (platform: string) => mockFetchMinimumVersion(platform),
  getInstalledVersion: () => '0.1.2',
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
      <UpdateRequiredGate>
        <Text>game</Text>
      </UpdateRequiredGate>,
    );
  });
  return tree;
};

const texts = (tree: Tree) =>
  tree.root
    .findAllByType(Text)
    .map((node) => node.props.children);

let openURL: jest.SpyInstance;

beforeEach(() => {
  mockFetchMinimumVersion.mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  openURL.mockRestore();
});

it('lets a current build through', async () => {
  mockFetchMinimumVersion.mockResolvedValue('0.1.2');

  expect(texts(await renderGate())).toEqual(['game']);
});

it('lets the app run when the minimum version cannot be read', async () => {
  mockFetchMinimumVersion.mockResolvedValue(null);

  expect(texts(await renderGate())).toEqual(['game']);
});

it('blocks an outdated build and sends it to the store', async () => {
  mockFetchMinimumVersion.mockResolvedValue('0.1.3');

  const tree = await renderGate();

  expect(texts(tree)).not.toContain('game');
  expect(texts(tree)).toContain(
    '新しいバージョンが公開されています。最新版にアップデートしてください。',
  );
  const [button] = tree.root.findAllByProps({ accessibilityRole: 'button' });
  void act(() => button.props.onPress());
  expect(openURL).toHaveBeenCalledWith(
    expect.stringMatching(/^https:\/\/(apps\.apple\.com|play\.google\.com)\//),
  );
});

it('blocks on return to the foreground once the minimum is raised', async () => {
  mockFetchMinimumVersion.mockResolvedValue('0.1.2');
  const tree = await renderGate();
  expect(texts(tree)).toEqual(['game']);

  mockFetchMinimumVersion.mockResolvedValue('0.1.3');
  await act(async () => {
    mockLifecycleListener?.({ appState: 'active' }, { appState: 'background' });
  });

  expect(texts(tree)).not.toContain('game');
});
