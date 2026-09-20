import { render } from '@testing-library/react';
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
beforeEach(() => {
  requests = [];
  jest.spyOn(window, 'Image').mockImplementation(() => {
    const image = document.createElement('img');
    Object.defineProperty(image, 'src', { set: (src: string) => requests.push(src) });
    return image;
  });
});
afterEach(() => jest.restoreAllMocks());

it.each<CardDesign>(['standard', 'densho'])('preloads every displayed face and back for %s', design => {
  const { container } = render(<CardDesignContext.Provider value={design}><Deck /></CardDesignContext.Provider>);
  const displayed = [...container.querySelectorAll('img, image')].map(image => image.getAttribute('src') ?? image.getAttribute('href'));
  expect(displayed).toHaveLength(54);
  expect(requests).toEqual(expect.arrayContaining(displayed));
});

it('preloads all 54 images when the saved design changes', () => {
  const { rerender } = render(<CardDesignContext.Provider value="standard"><Deck /></CardDesignContext.Provider>);
  expect(requests.some(src => src.includes('/densho/'))).toBe(false);
  requests = [];
  rerender(<CardDesignContext.Provider value="densho"><Deck /></CardDesignContext.Provider>);
  expect(requests.filter(src => src.includes('.webp?v='))).toHaveLength(54);
  expect(new Set(requests).size).toBe(54);
});
