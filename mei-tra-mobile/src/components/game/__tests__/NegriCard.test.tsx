import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { MiniCard } from '@/components/game/MiniCard';

import { NegriCard } from '../NegriCard';

jest.mock('@/components/game/MiniCard', () => ({
  MiniCard: () => null,
}));

// react-test-renderer's published types omit `root`, so the parts used here are
// declared explicitly.
interface Renderer {
  root: {
    findAll: (
      predicate: (node: { type: unknown; props: Record<string, unknown> }) => boolean,
    ) => { props: Record<string, unknown> }[];
    findAllByType: (
      type: typeof MiniCard,
    ) => { props: React.ComponentProps<typeof MiniCard> }[];
  };
  update: (element: React.ReactElement) => void;
  unmount: () => void;
}

const render = (element: React.ReactElement) => {
  let renderer!: Renderer;
  act(() => {
    renderer = TestRenderer.create(element) as unknown as Renderer;
  });
  return renderer;
};

const miniCard = (renderer: Renderer) =>
  renderer.root.findAllByType(MiniCard)[0].props;

const pressable = (renderer: Renderer) =>
  renderer.root.findAll(
    (node) => typeof node.type !== 'string' && node.props.testID === 'negri-card',
  )[0]?.props as
    | { onPress: () => void; accessibilityLabel: string }
    | undefined;

describe('NegriCard', () => {
  it('starts face down and flips to the chip and back on its owner taps', () => {
    const renderer = render(<NegriCard canReveal card="H-4" />);
    expect(miniCard(renderer)).toMatchObject({ card: 'H-4', faceDown: true });
    expect(pressable(renderer)?.accessibilityLabel).toBe('ネグリを表にする');

    act(() => pressable(renderer)?.onPress());
    expect(miniCard(renderer).faceDown).toBe(false);
    expect(pressable(renderer)?.accessibilityLabel).toBe('ネグリを裏にする');

    act(() => pressable(renderer)?.onPress());
    expect(miniCard(renderer).faceDown).toBe(true);

    act(() => renderer.unmount());
  });

  it('stays face down, with nothing to tap, for a viewer who may not look', () => {
    const renderer = render(<NegriCard canReveal={false} card="hidden" />);

    expect(miniCard(renderer).faceDown).toBe(true);
    expect(pressable(renderer)).toBeUndefined();

    act(() => renderer.unmount());
  });

  it('turns face down again when a new Negri takes its place', () => {
    const renderer = render(<NegriCard canReveal card="H-4" />);
    act(() => pressable(renderer)?.onPress());
    expect(miniCard(renderer).faceDown).toBe(false);

    act(() => renderer.update(<NegriCard canReveal card="S-3" />));

    expect(miniCard(renderer)).toMatchObject({ card: 'S-3', faceDown: true });

    act(() => renderer.unmount());
  });
});
