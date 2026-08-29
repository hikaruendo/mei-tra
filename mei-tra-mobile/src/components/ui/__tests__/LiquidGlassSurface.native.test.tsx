/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { LiquidGlassSurface } from '../LiquidGlassSurface.native';

const mockIsGlassEffectAPIAvailable = jest.fn();
const mockIsLiquidGlassAvailable = jest.fn();

jest.mock('expo-glass-effect', () => {
  const ReactRuntime = require('react') as typeof React;
  const { View: NativeView } =
    require('react-native') as typeof import('react-native');

  return {
    GlassView: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRuntime.createElement(NativeView, {
        ...props,
        testID: 'native-glass-view',
      }, children),
    isGlassEffectAPIAvailable: () => mockIsGlassEffectAPIAvailable(),
    isLiquidGlassAvailable: () => mockIsLiquidGlassAvailable(),
  };
});

interface RendererHandle {
  root: {
    findByProps: (props: Record<string, unknown>) => {
      props: Record<string, unknown>;
    };
    findByType: (type: unknown) => {
      props: { style?: unknown };
    };
  };
}

describe('LiquidGlassSurface native adapter', () => {
  beforeEach(() => {
    mockIsGlassEffectAPIAvailable.mockReset();
    mockIsLiquidGlassAvailable.mockReset();
  });

  it('uses the opaque fallback when the native API is unavailable', () => {
    mockIsGlassEffectAPIAvailable.mockReturnValue(false);
    let renderer!: RendererHandle;

    act(() => {
      renderer = TestRenderer.create(
        <LiquidGlassSurface
          fallbackStyle={{ backgroundColor: '#123456' }}
          style={{ borderRadius: 20 }}
          testID="surface"
        />,
      ) as unknown as RendererHandle;
    });

    const fallback = renderer.root.findByType(View);
    expect(StyleSheet.flatten(fallback.props.style)).toMatchObject({
      backgroundColor: '#123456',
      borderRadius: 20,
    });
    expect(mockIsLiquidGlassAvailable).not.toHaveBeenCalled();
  });

  it('uses regular interactive glass when both availability checks pass', () => {
    mockIsGlassEffectAPIAvailable.mockReturnValue(true);
    mockIsLiquidGlassAvailable.mockReturnValue(true);
    let renderer!: RendererHandle;

    act(() => {
      renderer = TestRenderer.create(
        <LiquidGlassSurface interactive tone="accent" />,
      ) as unknown as RendererHandle;
    });

    const glass = renderer.root.findByProps({ testID: 'native-glass-view' });
    expect(glass.props).toMatchObject({
      colorScheme: 'dark',
      glassEffectStyle: { style: 'regular', animate: true },
      isInteractive: true,
    });
    expect(glass.props.tintColor).toBeDefined();
  });
});
