import { Image } from 'expo-image';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { CardArtwork } from '../CardArtwork';

type ArtworkRenderer = {
  root: {
    findByType: (type: typeof Image | typeof Text) => {
      props: {
        children?: string;
        style: [unknown, { opacity: number }];
        onLoad: () => void;
        onError: () => void;
      };
    };
    findAllByType: (type: typeof Text) => unknown[];
  };
  unmount: () => void;
};

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

it('shows the card identity while a heritage image loads or fails', () => {
  let renderer!: ArtworkRenderer;
  act(() => {
    renderer = TestRenderer.create(<CardArtwork card="A♥" design="densho" width={60} />) as unknown as ArtworkRenderer;
  });
  expect(renderer.root.findByType(Text).props.children).toBe('A♥');
  const image = renderer.root.findByType(Image);
  expect(image.props.style[1].opacity).toBe(0);

  act(() => image.props.onLoad());
  expect(renderer.root.findAllByType(Text)).toHaveLength(0);
  expect(renderer.root.findByType(Image).props.style[1].opacity).toBe(1);

  act(() => renderer.root.findByType(Image).props.onError());
  expect(renderer.root.findByType(Text).props.children).toBe('A♥');
  act(() => renderer.unmount());
});

it('retries failed heritage artwork without remounting the card', () => {
  jest.useFakeTimers();
  let renderer!: ArtworkRenderer;
  act(() => {
    renderer = TestRenderer.create(<CardArtwork card="5♠" design="densho" width={60} />) as unknown as ArtworkRenderer;
  });
  const firstImage = renderer.root.findByType(Image);
  act(() => firstImage.props.onError());
  act(() => jest.advanceTimersByTime(1500));
  const retriedImage = renderer.root.findByType(Image);
  expect(retriedImage).not.toBe(firstImage);
  act(() => retriedImage.props.onLoad());
  expect(renderer.root.findAllByType(Text)).toHaveLength(0);
  act(() => renderer.unmount());
  jest.useRealTimers();
});

it('never prints the hidden card identity while its back loads', () => {
  let renderer!: ArtworkRenderer;
  act(() => {
    renderer = TestRenderer.create(<CardArtwork card="A♥" faceDown design="densho" width={60} />) as unknown as ArtworkRenderer;
  });
  expect(renderer.root.findByType(Text).props.children).toBe('M');
  act(() => renderer.unmount());
});
