import {
  shouldPlayCardSelectionSound,
  shouldPlayConfirmedNegriSound,
  soundEffectForCardSelection,
  soundEffectForGameEvent,
} from '@meitra/game-client/sound-effects';

import { WebSoundEffectsPlayer } from '@/lib/sound-effects';

const flushAudioSetup = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('sound effect event mapping', () => {
  it('maps live gameplay events to their effects', () => {
    expect(soundEffectForGameEvent('card-played')).toBe('cardPlay');
    expect(soundEffectForGameEvent('play-setup-complete')).toBe('negri');
    expect(soundEffectForGameEvent('game-started')).toBe('shuffle');
    expect(soundEffectForGameEvent('new-round-started')).toBe('shuffle');
    expect(soundEffectForGameEvent('game-over')).toBe('victory');
  });

  it('plays selection sounds only when a non-null card becomes selected', () => {
    expect(soundEffectForCardSelection()).toBe('cardSelect');
    expect(shouldPlayCardSelectionSound(null, 'H-A')).toBe(true);
    expect(shouldPlayCardSelectionSound('H-A', 'S-2')).toBe(true);
    expect(shouldPlayCardSelectionSound('H-A', 'H-A')).toBe(false);
    expect(shouldPlayCardSelectionSound('H-A', null)).toBe(false);
  });

  it('plays a confirmed Negri sound only for the matching pending card', () => {
    expect(shouldPlayConfirmedNegriSound('H-A', 'H-A')).toBe(true);
    expect(shouldPlayConfirmedNegriSound('S-2', 'H-A')).toBe(false);
    expect(shouldPlayConfirmedNegriSound(null, 'H-A')).toBe(false);
  });
});

describe('WebSoundEffectsPlayer', () => {
  const originalVisibilityState = document.visibilityState;
  let sourceStart: jest.Mock;
  let createBufferSource: jest.Mock;
  let context: AudioContext;
  let player: WebSoundEffectsPlayer | null;

  beforeEach(() => {
    sourceStart = jest.fn();
    createBufferSource = jest.fn(() => ({
      buffer: null,
      connect: jest.fn(),
      start: sourceStart,
    }));
    context = {
      state: 'running',
      destination: {},
      resume: jest.fn(async () => undefined),
      close: jest.fn(async () => undefined),
      decodeAudioData: jest.fn(async () => ({ duration: 0.5 } as AudioBuffer)),
      createBufferSource,
      createGain: jest.fn(() => ({
        gain: { value: 1 },
        connect: jest.fn(),
      })),
    } as unknown as AudioContext;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    player = null;
  });

  afterEach(() => {
    player?.dispose();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: originalVisibilityState,
    });
  });

  const createPlayer = () => {
    player = new WebSoundEffectsPlayer({
      createAudioContext: () => context,
      fetchImpl: jest.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })) as unknown as typeof fetch,
    });
    player.start();
    return player;
  };

  it('unlocks on a user gesture and supports overlapping card sounds', async () => {
    const soundPlayer = createPlayer();
    document.dispatchEvent(new Event('pointerdown'));
    await flushAudioSetup();

    soundPlayer.play('cardPlay');
    soundPlayer.play('cardPlay');
    soundPlayer.play('cardPlay');
    soundPlayer.play('cardPlay');

    expect(createBufferSource).toHaveBeenCalledTimes(4);
    expect(sourceStart).toHaveBeenCalledTimes(4);
  });

  it('waits for decoding when playback is requested from a user gesture', async () => {
    const soundPlayer = createPlayer();

    soundPlayer.playFromUserGesture('victory');
    expect(sourceStart).not.toHaveBeenCalled();

    await flushAudioSetup();
    expect(sourceStart).toHaveBeenCalledTimes(1);
  });

  it('calls the browser fetch implementation with its Window context', () => {
    const originalFetch = window.fetch;
    const browserFetch = jest.fn(function (this: Window) {
      if (this !== window) throw new TypeError('Illegal invocation');
      return Promise.resolve({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      } as Response);
    });
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      value: browserFetch,
    });

    try {
      player = new WebSoundEffectsPlayer({
        createAudioContext: () => context,
      });
      expect(() => player?.start()).not.toThrow();
      expect(browserFetch).toHaveBeenCalledTimes(5);
    } finally {
      Object.defineProperty(window, 'fetch', {
        configurable: true,
        value: originalFetch,
      });
    }
  });

  it('does not play when disabled or when the page is hidden', async () => {
    const soundPlayer = createPlayer();
    document.dispatchEvent(new Event('keydown'));
    await flushAudioSetup();

    soundPlayer.setEnabled(false);
    soundPlayer.play('cardPlay');
    soundPlayer.setEnabled(true);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    soundPlayer.play('shuffle');

    expect(createBufferSource).not.toHaveBeenCalled();
  });

  it('silently ignores audio startup failures', async () => {
    Object.defineProperty(context, 'state', {
      configurable: true,
      value: 'suspended',
    });
    context.resume = jest.fn(async () => {
      throw new DOMException('blocked', 'NotAllowedError');
    });
    const soundPlayer = createPlayer();

    expect(() => document.dispatchEvent(new Event('pointerdown'))).not.toThrow();
    await flushAudioSetup();
    soundPlayer.play('shuffle');

    expect(createBufferSource).not.toHaveBeenCalled();
  });

  it('silently absorbs preload failures before the first user gesture', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('network unavailable');
    }) as unknown as typeof fetch;
    player = new WebSoundEffectsPlayer({
      createAudioContext: () => context,
      fetchImpl,
    });

    player.start();
    await flushAudioSetup();

    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(context.decodeAudioData).not.toHaveBeenCalled();
  });

  it('keeps loading the remaining effects when one asset fails', async () => {
    const fetchImpl = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('card-play')) {
        throw new TypeError('network unavailable');
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      } as Response;
    }) as unknown as typeof fetch;
    player = new WebSoundEffectsPlayer({
      createAudioContext: () => context,
      fetchImpl,
    });
    player.start();

    document.dispatchEvent(new Event('pointerdown'));
    await flushAudioSetup();
    player.play('cardPlay');
    player.play('cardSelect');
    player.play('negri');
    player.play('shuffle');
    player.play('victory');

    expect(context.decodeAudioData).toHaveBeenCalledTimes(4);
    expect(sourceStart).toHaveBeenCalledTimes(4);
  });
});
