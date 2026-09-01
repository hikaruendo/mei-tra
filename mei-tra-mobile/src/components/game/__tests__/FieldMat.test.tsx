import { Image } from 'expo-image';
import TestRenderer from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { FieldMat } from '../FieldMat';

const flatten = (style: unknown): ViewStyle =>
  (StyleSheet.flatten(style as ViewStyle) ?? {}) as ViewStyle;

/**
 * Structural, matching GameBoard.test.tsx: `ReactTestRenderer` does not
 * declare `root` in this version's typings.
 */
interface Rendered {
  root: {
    findByType: (type: unknown) => { props: Record<string, unknown> };
  };
  unmount: () => void;
}

const renderMat = () => {
  let renderer!: Rendered;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(<FieldMat />) as unknown as Rendered;
  });
  return renderer;
};

describe('FieldMat', () => {
  it('renders the cushion artwork', () => {
    // The require has to resolve through metro, tsc and jest alike; this is
    // the only place that proves the webp does.
    const renderer = renderMat();
    const image = renderer.root.findByType(Image);
    expect(image.props.source).toBeDefined();
    expect(image.props.contentFit).toBe('contain');
    TestRenderer.act(() => renderer.unmount());
  });

  it('declares no size of its own, so it cannot overhang its parent', () => {
    // The regression this pins: the mat used to take a `size` prop set from a
    // constant larger than the box it was centred in, and hung 7pt past the
    // top and bottom of it. Only RN's lack of clipping kept it visible.
    const renderer = renderMat();
    const style = flatten(renderer.root.findByType(View).props.style);

    expect(style.width).toBeUndefined();
    expect(style.height).toBeUndefined();
    expect(style.marginLeft).toBeUndefined();
    expect(style.marginTop).toBeUndefined();
    expect(style).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });

    TestRenderer.act(() => renderer.unmount());
  });

  it('stays out of the way of taps and screen readers', () => {
    const renderer = renderMat();
    const root = renderer.root.findByType(View);
    expect(root.props.pointerEvents).toBe('none');
    expect(root.props.accessibilityElementsHidden).toBe(true);
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
    TestRenderer.act(() => renderer.unmount());
  });
});
