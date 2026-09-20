import { Image } from 'expo-image';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { CardArtwork } from '../CardArtwork';

it.each([
  { design: 'standard', card: 'K♣' },
  { design: 'densho', card: 'K♣' },
  { design: 'densho', card: '5♣' },
] as const)('keeps $design $card artwork from starting a browser image drag', ({ design, card }) => {
  let renderer!: {
    root: { findByType: (type: typeof Image) => { props: { draggable?: boolean } } };
    unmount: () => void;
  };
  act(() => {
    renderer = TestRenderer.create(<CardArtwork card={card} design={design} width={60} />) as unknown as typeof renderer;
  });
  // A browser dragstart terminates PanResponder before a card can be moved.
  // The image must leave dragging to the hand, even before the first tap.
  expect(renderer.root.findByType(Image).props.draggable).toBe(false);
  act(() => renderer.unmount());
});
