import { act, fireEvent, render } from '@testing-library/react';
import type { CardDesign } from '@meitra/contracts/profile';
import { CARD_RANKS } from '@meitra/game-client/card-art';
import { CardFace } from '@/components/game/CardFace';
import { CardDesignContext } from '@/contexts/CardDesignContext';
import { usePreloadCards } from '@/hooks/usePreloadCards';

function Deck() {
  usePreloadCards();
  return <>
    {CARD_RANKS.flatMap(rank => ['♠', '♥', '♦', '♣'].map(suit => (
      <CardFace key={`${rank}${suit}`} card={`${rank}${suit}`} />
    )))}
    <CardFace card="JOKER" />
    <CardFace faceDown />
  </>;
}

let requests: string[];
let images: HTMLImageElement[];
beforeEach(() => {
  jest.useFakeTimers();
  requests = [];
  images = [];
  jest.spyOn(window, 'Image').mockImplementation(() => {
    const image = document.createElement('img');
    images.push(image);
    Object.defineProperty(image, 'src', { set: (src: string) => requests.push(src) });
    return image;
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it.each<CardDesign>(['standard', 'densho'])('preloads every displayed face and back for %s without flooding initial render', design => {
  const { container } = render(<CardDesignContext.Provider value={design}><Deck /></CardDesignContext.Provider>);
  const displayed = [...container.querySelectorAll('img, image')].map(image => image.getAttribute('src') ?? image.getAttribute('href'));
  expect(displayed).toHaveLength(54);
  expect(requests).toHaveLength(0);
  act(() => jest.advanceTimersByTime(500));
  expect(requests).toHaveLength(2);
  for (let index = 0; index < displayed.length; index++) {
    act(() => fireEvent.load(images[index]));
  }
  expect(requests).toEqual(expect.arrayContaining(displayed));
});

it('stops the old queue and starts the new design when the saved design changes', () => {
  const { rerender } = render(<CardDesignContext.Provider value="standard"><Deck /></CardDesignContext.Provider>);
  act(() => jest.advanceTimersByTime(500));
  expect(requests).toHaveLength(2);
  expect(requests.some(src => src.includes('/densho/'))).toBe(false);
  requests = [];
  rerender(<CardDesignContext.Provider value="densho"><Deck /></CardDesignContext.Provider>);
  act(() => fireEvent.load(images[0]));
  expect(requests).toHaveLength(0);
  act(() => jest.advanceTimersByTime(500));
  expect(requests).toHaveLength(2);
  expect(requests.every(src => src.includes('.webp?v='))).toBe(true);
});
