import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Player } from '../../types/game.types';
import { getPlayerProfile, getDefaultAvatarUrl, PlayerProfile } from '../../lib/utils/profileUtils';
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
  }, [player.userId, player.name, player.isAuthenticated]);

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

  return (
    <div className={`${styles.playerAvatar} ${styles[size]} ${className}`}>
      <div className={styles.avatarContainer}>
        <Image
          src={getAvatarSrc()}
          alt={`${displayName}'s avatar`}
          width={sizePixels}
          height={sizePixels}
          className={styles.avatarImage}
          onError={handleImageError}
          priority={false}
        />
      </div>
      {showName && (
        <div className={styles.playerName}>
          {displayName}
        </div>
      )}
    </div>
  );
};