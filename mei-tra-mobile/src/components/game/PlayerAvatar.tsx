import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { fetchPlayerProfile } from '@/lib/profile-api';
import { colors } from '@/theme/colors';
import type { MobilePlayer } from '@/types/game';

interface PlayerAvatarProps {
  player: MobilePlayer;
  size: number;
}

export function PlayerAvatar({ player, size }: PlayerAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setImageFailed(false);

    if (player.isCOM || !player.userId || !player.isAuthenticated) {
      setAvatarUrl(null);
      return () => {
        cancelled = true;
      };
    }

    void fetchPlayerProfile(player.userId)
      .then((profile) => {
        if (!cancelled) setAvatarUrl(profile.avatarUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setAvatarUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    player.isAuthenticated,
    player.isCOM,
    player.seatId,
    player.socketId,
    player.userId,
  ]);

  const radius = Math.round(size * 0.3);

  return (
    <View
      style={[
        styles.frame,
        player.isCOM && styles.comFrame,
        { width: size, height: size, borderRadius: radius },
      ]}
      testID={`player-avatar-${player.seatId}`}
    >
      {!player.isCOM && avatarUrl && !imageFailed ? (
        <Image
          accessibilityLabel={`${player.name} avatar`}
          onError={() => setImageFailed(true)}
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size, borderRadius: radius }}
          testID={`player-avatar-image-${player.seatId}`}
        />
      ) : (
        <Text style={[styles.fallback, { fontSize: Math.round(size * 0.53) }]}>
          {player.isCOM ? '🤖' : '●'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.gold,
  },
  comFrame: {
    backgroundColor: colors.backgroundElevated,
  },
  fallback: {
    color: colors.text,
  },
});
