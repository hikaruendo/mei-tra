'use client';

import { useEffect } from 'react';
import { CARD_ART_IDS, DENSHO_ART } from '@meitra/game-client/card-art';
import { useCardDesign } from '@/contexts/CardDesignContext';

export function usePreloadCards() {
  const design = useCardDesign();
  useEffect(() => {
    const paths = design === 'densho'
      ? CARD_ART_IDS.map(id => Object.prototype.hasOwnProperty.call(DENSHO_ART, id)
        ? `/cards/densho/${id}.jpg`
        : `/cards/densho/styled/${id}.webp`)
      : [...CARD_ART_IDS.map(id => `/cards/${id}.svg`), '/cards/joker_black.svg'];
    paths.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, [design]);
}
