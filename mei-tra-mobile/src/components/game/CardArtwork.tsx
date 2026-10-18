import type { CardDesign } from '@meitra/contracts/profile';
import { denshoImageSize, resolveDenshoArtId, resolveDenshoStyledArtId } from '@meitra/game-client/card-art';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';

import { useCardDesign } from '@/context/CardDesignContext';
import { DENSHO_STYLED_SOURCES } from '@/lib/densho-card-assets';
import { resolveCardArt } from '@/lib/card-art-assets';
import { palette } from '@/theme/palette';

function RasterCardArtwork({ source, card, faceDown, width, fill }: {
  source: number;
  card: string;
  faceDown: boolean;
  width?: number;
  fill: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallback = faceDown ? 'M' : card;
  const fontSize = card === 'JOKER' && !faceDown
    ? Math.max(6, Math.min((width ?? 72) * 0.16, 16))
    : Math.max(9, Math.min((width ?? 72) * 0.34, 30));

  useEffect(() => () => {
    if (retryTimer.current !== null) clearTimeout(retryTimer.current);
  }, []);

  const handleLoad = () => {
    if (retryTimer.current !== null) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    setLoaded(true);
  };

  const handleError = () => {
    setLoaded(false);
    if (retry < 2 && retryTimer.current === null) {
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        setRetry(value => value + 1);
      }, 1500 * (retry + 1));
    }
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {!loaded && (
        <View style={styles.fallback}>
          <Text style={{ color: /[♥♦]/.test(card) && !faceDown ? palette.card.red : palette.card.ink, fontSize, fontWeight: '700' }}>
            {fallback}
          </Text>
        </View>
      )}
      <Image
        key={retry}
        draggable={false}
        contentFit={fill ? 'fill' : 'cover'}
        source={source}
        style={[StyleSheet.absoluteFill, { opacity: loaded ? 1 : 0 }]}
        onLoad={handleLoad}
        onError={handleError}
      />
    </View>
  );
}

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
    const source = DENSHO_STYLED_SOURCES[artId][size]();
    return <RasterCardArtwork key={source} source={source} card={card} faceDown={faceDown} width={width} fill />;
  }
  const art = resolveCardArt(card, faceDown);
  return art.kind === 'vector' ? (
    <art.Svg height="100%" width="100%" preserveAspectRatio={fill ? 'none' : 'xMidYMid meet'} />
  ) : (
    <RasterCardArtwork key={art.source} source={art.source} card={card} faceDown={faceDown} width={width} fill={fill} />
  );
}

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card.face,
  },
});
