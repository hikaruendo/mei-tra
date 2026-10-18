'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardDesign } from '@meitra/contracts/profile';
import { DENSHO_ASSET_REVISION, denshoImagePath, resolveDenshoArtId, resolveDenshoStyledArtId } from '@meitra/game-client/card-art';
import { useCardDesign } from '@/contexts/CardDesignContext';
import { cardToSvgPath, CARD_BACK_PATH } from '@/lib/utils/cardMapping';
import styles from './index.module.scss';

interface CardFaceProps {
  card?: string;
  faceDown?: boolean;
  className?: string;
  /** Preview a design without changing the saved profile. */
  design?: CardDesign;
}

export function CardFace({ card, faceDown = false, className, design }: CardFaceProps) {
  const savedDesign = useCardDesign();
  const imageId = resolveDenshoArtId(card ?? '', faceDown, design ?? savedDesign)
    ?? resolveDenshoStyledArtId(card ?? '', faceDown, design ?? savedDesign);
  const label = faceDown ? 'Card back' : card;
  const src = imageId ? `${denshoImagePath(imageId)}?v=${DENSHO_ASSET_REVISION}` : faceDown ? CARD_BACK_PATH : cardToSvgPath(card ?? '');

  return <LoadedCardFace key={src} src={src} label={label} card={card} faceDown={faceDown} className={className} />;
}

function LoadedCardFace({ src, label, card, faceDown, className }: {
  src: string;
  label?: string;
  card?: string;
  faceDown: boolean;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const retryTimer = useRef<number | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const red = !faceDown && /[♥♦]/.test(card ?? '');
  const imageSrc = retry === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=${retry}`;

  useEffect(() => () => {
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
  }, []);

  const handleError = useCallback(() => {
    setLoaded(false);
    if (retry < 2 && retryTimer.current === null) {
      retryTimer.current = window.setTimeout(() => {
        retryTimer.current = null;
        setRetry(value => value + 1);
      }, 1500 * (retry + 1));
    }
  }, [retry]);

  const handleLoad = useCallback(() => {
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    setLoaded(true);
  }, []);

  // The browser can finish a cached image before React hydrates and attaches
  // onLoad. Inspect the element too, or the fallback can remain forever.
  useEffect(() => {
    const image = imageRef.current;
    if (!image?.complete) return;
    if (image.naturalWidth > 0) handleLoad();
    else handleError();
  }, [imageSrc, handleError, handleLoad]);

  return (
    <span className={`${styles.cardFace} ${className ?? ''}`}>
      {!loaded && <span aria-hidden="true" className={`${styles.fallback} ${red ? styles.red : ''} ${card === 'JOKER' && !faceDown ? styles.joker : ''}`}>
        {faceDown ? 'M' : card === 'JOKER' ? 'JOKER' : card}
      </span>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        className={styles.cardSvg}
        src={imageSrc}
        alt={label}
        draggable={false}
        onLoad={handleLoad}
        onError={handleError}
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </span>
  );
}
