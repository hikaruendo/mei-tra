'use client';

import { useEffect } from 'react';
import { CARD_BACK_PATH } from '../lib/utils/cardMapping';

const ALL_SUITS = ['S', 'H', 'D', 'C'];
const ALL_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function usePreloadCards() {
  useEffect(() => {
    const paths = [
      ...ALL_RANKS.flatMap(r => ALL_SUITS.map(s => `/cards/${r}_${s}.svg`)),
      '/cards/joker_red.svg',
      '/cards/joker_black.svg',
      CARD_BACK_PATH,
    ];
    paths.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);
}
