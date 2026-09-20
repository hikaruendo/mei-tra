import type { CardDesign } from '@meitra/contracts/profile';
import { denshoImageSize, resolveDenshoArtId, resolveDenshoStyledArtId } from '@meitra/game-client/card-art';
import { Image } from 'expo-image';
import { PixelRatio, StyleSheet } from 'react-native';

import { useCardDesign } from '@/context/CardDesignContext';
import { DENSHO_STYLED_SOURCES } from '@/lib/densho-card-assets';
import { resolveCardArt } from '@/lib/card-art-assets';

export function CardArtwork({ card = '', faceDown = false, design, fill = false, width }: {
  card?: string;
  faceDown?: boolean;
  design?: CardDesign;
  fill?: boolean;
  width?: number;
}) {
  const savedDesign = useCardDesign();
  const artId = resolveDenshoArtId(card, faceDown, design ?? savedDesign)
    ?? resolveDenshoStyledArtId(card, faceDown, design ?? savedDesign);
  // Browser image dragging cancels the hand's PanResponder. Only the hand
  // should own the gesture; selecting the card must never be required first.
  if (artId) {
    const size = width === undefined ? 'large' : denshoImageSize(width * PixelRatio.get());
    return <Image draggable={false} contentFit="fill" source={DENSHO_STYLED_SOURCES[artId][size]()} style={StyleSheet.absoluteFill} />;
  }
  const art = resolveCardArt(card, faceDown);
  return art.kind === 'vector' ? (
    <art.Svg height="100%" width="100%" preserveAspectRatio={fill ? 'none' : 'xMidYMid meet'} />
  ) : (
    <Image draggable={false} contentFit={fill ? 'fill' : 'cover'} source={art.source} style={StyleSheet.absoluteFill} />
  );
}
