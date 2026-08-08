/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Button } from '@/components/ui/Button';

jest.mock('react-native', () => {
  const ReactRuntime = require('react');
  const primitive = (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRuntime.createElement(name, props, children);

  return {
    ActivityIndicator: primitive('ActivityIndicator'),
    Pressable: primitive('Pressable'),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: primitive('Text'),
  };
});

const renderer = require('react-test-renderer') as {
  act: (callback: () => void) => void;
  create: (element: React.ReactElement) => {
    root: {
      findAllByProps: (
        props: Record<string, unknown>,
      ) => { props: Record<string, unknown> }[];
    };
  };
};

describe('Button', () => {
  it('exposes disabled and busy accessibility state while loading', () => {
    let tree: ReturnType<typeof renderer.create>;
    renderer.act(() => {
      tree = renderer.create(<Button loading>ゲーム開始</Button>);
    });

    const pressables = tree!.root.findAllByProps({
      accessibilityRole: 'button',
    });

    const pressable = pressables.find((candidate) => candidate.props.disabled);
    expect(pressable).toBeDefined();
    expect(pressable?.props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });
});
