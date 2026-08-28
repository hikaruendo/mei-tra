import {
  setAudioModeAsync,
  useAudioPlayer,
  type AudioPlayer,
} from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { SoundEffect } from '@meitra/game-client/sound-effects';

const CARD_PLAY_SOURCE = require('../../assets/sounds/card-play.mp3');
const CARD_SELECT_SOURCE = require('../../assets/sounds/card-select.mp3');
const CANCEL_SOURCE = require('../../assets/sounds/cancel.mp3');
const NEGRI_SOURCE = require('../../assets/sounds/negri.mp3');
const SHUFFLE_SOURCE = require('../../assets/sounds/shuffle.mp3');
const VICTORY_SOURCE = require('../../assets/sounds/victory.mp3');
const DEFEAT_SOURCE = require('../../assets/sounds/defeat.mp3');
const RESULT_NEUTRAL_SOURCE = require('../../assets/sounds/result-neutral.mp3');

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
  const cardSelectPlayer = useAudioPlayer(CARD_SELECT_SOURCE);
  const cancelPlayer = useAudioPlayer(CANCEL_SOURCE);
  const negriPlayer = useAudioPlayer(NEGRI_SOURCE);
  const shufflePlayer = useAudioPlayer(SHUFFLE_SOURCE);
  const victoryPlayer = useAudioPlayer(VICTORY_SOURCE);
  const defeatPlayer = useAudioPlayer(DEFEAT_SOURCE);
  const resultNeutralPlayer = useAudioPlayer(RESULT_NEUTRAL_SOURCE);
  const playersRef = useRef({
    cards: [cardPlayerA, cardPlayerB, cardPlayerC],
    cardSelect: cardSelectPlayer,
    cancel: cancelPlayer,
    negri: negriPlayer,
    shuffle: shufflePlayer,
    victory: victoryPlayer,
    defeat: defeatPlayer,
    resultNeutral: resultNeutralPlayer,
  });
  const nextCardPlayerRef = useRef(0);
  const enabledRef = useRef(enabled);
  const appStateRef = useRef(AppState.currentState);

  playersRef.current = {
    cards: [cardPlayerA, cardPlayerB, cardPlayerC],
    cardSelect: cardSelectPlayer,
    cancel: cancelPlayer,
    negri: negriPlayer,
    shuffle: shufflePlayer,
    victory: victoryPlayer,
    defeat: defeatPlayer,
    resultNeutral: resultNeutralPlayer,
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

    if (effect === 'victory') {
      void replay(playersRef.current.victory, 0.25);
      return;
    }

    if (effect === 'defeat') {
      void replay(playersRef.current.defeat, 0.25);
      return;
    }

    if (effect === 'resultNeutral') {
      void replay(playersRef.current.resultNeutral, 0.4);
      return;
    }

    if (effect === 'negri') {
      void replay(playersRef.current.negri, 0.5);
      return;
    }

    if (effect === 'cardSelect') {
      void replay(playersRef.current.cardSelect, 0.42);
      return;
    }

    if (effect === 'cancel') {
      void replay(playersRef.current.cancel, 0.32);
      return;
    }

    const players = playersRef.current.cards;
    const player = players[nextCardPlayerRef.current % players.length];
    nextCardPlayerRef.current += 1;
    void replay(player, 0.55);
  }, []);
};
