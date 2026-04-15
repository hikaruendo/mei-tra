import { cardToSvgPath, CARD_BACK_PATH } from '../../lib/utils/cardMapping';
import styles from './index.module.scss';

interface CardFaceProps {
  card?: string;
  faceDown?: boolean;
  className?: string;
}

export function CardFace({ card, faceDown, className }: CardFaceProps) {
  const src = faceDown ? CARD_BACK_PATH : cardToSvgPath(card ?? '');

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`${styles.cardSvg} ${className ?? ''}`}
      src={src}
      alt={faceDown ? 'Card back' : card}
      draggable={false}
    />
  );
}
