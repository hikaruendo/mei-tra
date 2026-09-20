'use client';

import { useEffect } from 'react';
import { CARD_ART_IDS, DENSHO_ASSET_REVISION, denshoImagePath } from '@meitra/game-client/card-art';
import { useCardDesign } from '@/contexts/CardDesignContext';

export function usePreloadCards() {
  const design = useCardDesign();
  useEffect(() => {
    const paths = design === 'densho'
      ? CARD_ART_IDS.map(id => `${denshoImagePath(id)}?v=${DENSHO_ASSET_REVISION}`)
      : [...CARD_ART_IDS.map(id => `/cards/${id}.svg`), '/cards/joker_black.svg'];
    paths.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, [design]);
}
