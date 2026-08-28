import { useCallback, useEffect, useRef } from 'react';
import type { SoundEffect } from '@meitra/game-client/sound-effects';

import { WebSoundEffectsPlayer } from '@/lib/sound-effects';

export const useSoundEffects = (enabled: boolean) => {
  const playerRef = useRef<WebSoundEffectsPlayer | null>(null);

  useEffect(() => {
    const player = new WebSoundEffectsPlayer();
    player.start();
    playerRef.current = player;

    return () => {
      playerRef.current = null;
      player.dispose();
    };
  }, []);

  useEffect(() => {
    playerRef.current?.setEnabled(enabled);
  }, [enabled]);

  return useCallback((effect: SoundEffect) => {
    playerRef.current?.play(effect);
  }, []);
};
