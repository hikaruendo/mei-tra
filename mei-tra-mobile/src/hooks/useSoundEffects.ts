import {
  setAudioModeAsync,
  useAudioPlayer,
  type AudioPlayer,
} from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { SoundEffect } from '@meitra/game-client/sound-effects';

const CARD_PLAY_SOURCE = require('../../assets/sounds/card-play.mp3');
const NEGRI_SOURCE = require('../../assets/sounds/negri.mp3');
const SHUFFLE_SOURCE = require('../../assets/sounds/shuffle.mp3');

const replay = async (player: AudioPlayer, volume: number) => {
  try {
    player.volume = volume;
    await player.seekTo(0);
    player.play();
  } catch {
    // Sound effects are optional feedback and must never interrupt gameplay.
  }
};

export const useSoundEffects = (enabled: boolean) => {
  const cardPlayerA = useAudioPlayer(CARD_PLAY_SOURCE);
  const cardPlayerB = useAudioPlayer(CARD_PLAY_SOURCE);
  const cardPlayerC = useAudioPlayer(CARD_PLAY_SOURCE);
  const negriPlayer = useAudioPlayer(NEGRI_SOURCE);
  const shufflePlayer = useAudioPlayer(SHUFFLE_SOURCE);
  const playersRef = useRef({
    cards: [cardPlayerA, cardPlayerB, cardPlayerC],
    negri: negriPlayer,
    shuffle: shufflePlayer,
  });
  const nextCardPlayerRef = useRef(0);
  const enabledRef = useRef(enabled);
  const appStateRef = useRef(AppState.currentState);

  playersRef.current = {
    cards: [cardPlayerA, cardPlayerB, cardPlayerC],
    negri: negriPlayer,
    shuffle: shufflePlayer,
  };
  enabledRef.current = enabled;

  useEffect(() => {
    void setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: false,
      shouldPlayInBackground: false,
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  return useCallback((effect: SoundEffect) => {
    if (!enabledRef.current || appStateRef.current !== 'active') return;

    if (effect === 'shuffle') {
      void replay(playersRef.current.shuffle, 0.45);
      return;
    }

    if (effect === 'negri') {
      void replay(playersRef.current.negri, 0.5);
      return;
    }

    const players = playersRef.current.cards;
    const player = players[nextCardPlayerRef.current % players.length];
    nextCardPlayerRef.current += 1;
    void replay(player, 0.55);
  }, []);
};
