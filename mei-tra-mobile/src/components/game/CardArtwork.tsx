import type { CardDesign } from '@meitra/contracts/profile';
import { DENSHO_ART, resolveDenshoArtId } from '@meitra/game-client/card-art';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import Svg, { Image as SvgImage } from 'react-native-svg';

import { useCardDesign } from '@/context/CardDesignContext';
import { resolveCardArt } from '@/lib/card-art-assets';

const DENSHO_SOURCES = {
  card_back: require('../../../../shared/game-client/assets/densho/card_back.jpg'),
  joker_red: require('../../../../shared/game-client/assets/densho/joker_red.jpg'),
  A_S: require('../../../../shared/game-client/assets/densho/A_S.jpg'),
};

export function CardArtwork({ card = '', faceDown = false, design, fill = false }: {
  card?: string;
  faceDown?: boolean;
  design?: CardDesign;
  fill?: boolean;
}) {
  const savedDesign = useCardDesign();
  const artId = resolveDenshoArtId(card, faceDown, design ?? savedDesign);
  if (artId) {
    const art = DENSHO_ART[artId];
    return (
      <Svg height="100%" width="100%" viewBox={art.viewBox} preserveAspectRatio="none">
        <SvgImage href={DENSHO_SOURCES[artId]} width={art.width} height={art.height} />
      </Svg>
    );
  }
  const art = resolveCardArt(card, faceDown);
  return art.kind === 'vector' ? (
    <art.Svg height="100%" width="100%" preserveAspectRatio={fill ? 'none' : 'xMidYMid meet'} />
  ) : (
    <Image contentFit={fill ? 'fill' : 'cover'} source={art.source} style={StyleSheet.absoluteFill} />
  );
}
