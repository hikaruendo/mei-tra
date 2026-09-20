'use client';

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
  const classes = `${styles.cardSvg} ${className ?? ''}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={classes}
      src={imageId ? `${denshoImagePath(imageId)}?v=${DENSHO_ASSET_REVISION}` : faceDown ? CARD_BACK_PATH : cardToSvgPath(card ?? '')}
      alt={label}
      draggable={false}
    />
  );
}
