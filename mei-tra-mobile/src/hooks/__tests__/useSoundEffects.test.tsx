import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { SoundEffect } from '@meitra/game-client/sound-effects';

import { useSoundEffects } from '../useSoundEffects';

const mockSetAudioModeAsync = jest.fn(async (_options: unknown) => undefined);
const mockPlayers = Array.from({ length: 11 }, () => ({
  play: jest.fn(),
  seekTo: jest.fn(async () => undefined),
  volume: 1,
}));
let mockNextPlayer = 0;

jest.mock('expo-audio', () => ({
  setAudioModeAsync: (options: unknown) => mockSetAudioModeAsync(options),
  useAudioPlayer: () =>
    mockPlayers[mockNextPlayer++ % mockPlayers.length],
}));

function CaptureSoundEffects({
  enabled,
  onValue,
}: {
  enabled: boolean;
  onValue: (play: (effect: SoundEffect) => void) => void;
}) {
  const play = useSoundEffects(enabled);
  useEffect(() => onValue(play), [onValue, play]);
  return null;
}

describe('useSoundEffects', () => {
  let removeAppStateListener: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNextPlayer = 0;
    removeAppStateListener = jest.fn();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => {
      return { remove: removeAppStateListener };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('configures silent-mode-safe audio and rotates card players', async () => {
    let playEffect: (effect: SoundEffect) => void = () => undefined;
    let renderer: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        <CaptureSoundEffects
          enabled
          onValue={(play) => {
            playEffect = play;
          }}
        />,
      );
    });

    expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: false,
      shouldPlayInBackground: false,
    });

    await act(async () => {
      playEffect('cardPlay');
      playEffect('cardPlay');
      playEffect('cardPlay');
      playEffect('cardPlay');
      await Promise.resolve();
    });

    expect(mockPlayers[0].play).toHaveBeenCalledTimes(2);
    expect(mockPlayers[1].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[2].play).toHaveBeenCalledTimes(1);

    await act(async () => renderer!.unmount());
    expect(removeAppStateListener).toHaveBeenCalled();
  });

  it('does not play while disabled or in the background', async () => {
    let playEffect: (effect: SoundEffect) => void = () => undefined;
    let renderer: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        <CaptureSoundEffects
          enabled={false}
          onValue={(play) => {
            playEffect = play;
          }}
        />,
      );
    });

    playEffect('shuffle');
    await act(async () => {
      renderer!.unmount();
    });
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'background',
    });
    await act(async () => {
      renderer = TestRenderer.create(
        <CaptureSoundEffects enabled onValue={(play) => (playEffect = play)} />,
      );
    });
    playEffect('cardPlay');
    await Promise.resolve();

    expect(mockPlayers.every((player) => player.play.mock.calls.length === 0)).toBe(
      true,
    );
    await act(async () => renderer!.unmount());
  });

  it('uses a dedicated player for card selection sounds', async () => {
    let playEffect: (effect: SoundEffect) => void = () => undefined;
    let renderer: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        <CaptureSoundEffects enabled onValue={(play) => (playEffect = play)} />,
      );
    });

    await act(async () => {
      playEffect('cardSelect');
      await Promise.resolve();
    });

    expect(mockPlayers[3].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[3].volume).toBe(0.42);
    expect(mockPlayers[4].play).not.toHaveBeenCalled();

    await act(async () => renderer!.unmount());
  });

  it('uses the dedicated player for Negri sounds', async () => {
    let playEffect: (effect: SoundEffect) => void = () => undefined;
    let renderer: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        <CaptureSoundEffects enabled onValue={(play) => (playEffect = play)} />,
      );
    });

    await act(async () => {
      playEffect('negri');
      await Promise.resolve();
    });

    expect(mockPlayers[6].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[6].volume).toBe(0.5);
    expect(mockPlayers[3].play).not.toHaveBeenCalled();
    expect(mockPlayers[7].play).not.toHaveBeenCalled();

    await act(async () => renderer!.unmount());
  });

  it('uses dedicated players for cancel and turn-transition sounds', async () => {
    let playEffect: (effect: SoundEffect) => void = () => undefined;
    let renderer: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        <CaptureSoundEffects enabled onValue={(play) => (playEffect = play)} />,
      );
    });

    await act(async () => {
      playEffect('cancel');
      playEffect('turnTransition');
      await Promise.resolve();
    });

    expect(mockPlayers[4].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[4].volume).toBe(0.32);
    expect(mockPlayers[5].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[5].volume).toBe(0.3);

    await act(async () => renderer!.unmount());
  });

  it('uses dedicated players for each game-result viewpoint', async () => {
    let playEffect: (effect: SoundEffect) => void = () => undefined;
    let renderer: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        <CaptureSoundEffects enabled onValue={(play) => (playEffect = play)} />,
      );
    });
    await act(async () => {
      playEffect('victory');
      playEffect('defeat');
      playEffect('resultNeutral');
      await Promise.resolve();
    });
    expect(mockPlayers[8].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[8].volume).toBe(0.25);
    expect(mockPlayers[9].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[9].volume).toBe(0.25);
    expect(mockPlayers[10].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[10].volume).toBe(0.4);
    await act(async () => renderer!.unmount());
  });
});
