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
    let next = 0;
    let cancelled = false;
    const active = new Set<HTMLImageElement>();
    const preloadNext = () => {
      if (cancelled || next >= paths.length) return;
      const img = new Image();
      active.add(img);
      img.onload = img.onerror = () => {
        active.delete(img);
        preloadNext();
      };
      img.src = paths[next++];
    };

    // Visible cards load through their own <img> elements first. The rest of
    // the deck is warmed in the background without competing with the hand.
    const timer = window.setTimeout(() => {
      preloadNext();
      preloadNext();
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      active.forEach(img => { img.onload = img.onerror = null; });
      active.clear();
    };
  }, [design]);
}
