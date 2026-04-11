import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Player } from '../../types/game.types';
import { getPlayerProfile, getDefaultAvatarUrl, PlayerProfile } from '../../lib/utils/profileUtils';
import { PlayerIdentityChip } from '../PlayerIdentityChip';
import styles from './index.module.scss';

interface PlayerAvatarProps {
  player: Player;
  size?: 'small' | 'medium' | 'large';
  showName?: boolean;
  className?: string;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  player,
  size = 'medium',
  showName = true,
  className = '',
}) => {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    getPlayerProfile(player).then(setProfile);
  }, [player]);

  const handleImageError = () => {
    setImageError(true);
  };

  const getAvatarSrc = (): string => {
    if (imageError || !profile?.avatarUrl) {
      return getDefaultAvatarUrl();
    }
    return profile.avatarUrl;
  };

  const getSizePixels = () => {
    switch (size) {
      case 'small':
        return 32;
      case 'large':
        return 80;
      case 'medium':
      default:
        return 64;
    }
  };

  const displayName = profile?.displayName || player.name;
  const sizePixels = getSizePixels();
  const isDefaultAvatar = imageError || !profile?.avatarUrl;
  const avatarSrc = getAvatarSrc();

  return (
    <div className={`${styles.playerAvatar} ${styles[size]} ${className}`}>
      <div className={styles.avatarContainer}>
        <Image
          src={avatarSrc}
          alt={`${displayName}'s avatar`}
          width={sizePixels}
          height={sizePixels}
          className={styles.avatarImage}
          onError={handleImageError}
          priority={false}
          unoptimized={isDefaultAvatar}
        />
        {player.isCOM && (
          <div className={styles.comBadge}>
            <span className={styles.comIcon}>🤖</span>
          </div>
        )}
      </div>
      {showName && (
        <PlayerIdentityChip
          name={displayName}
          className={styles.playerName}
        />
      )}
    </div>
  );
};
