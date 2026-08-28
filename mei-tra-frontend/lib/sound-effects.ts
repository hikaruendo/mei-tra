import type { SoundEffect } from '@meitra/game-client/sound-effects';

const SOUND_URLS: Record<SoundEffect, string> = {
  cardPlay: '/sounds/card-play.mp3',
  cardSelect: '/sounds/card-select.mp3',
  negri: '/sounds/negri.mp3',
  shuffle: '/sounds/shuffle.mp3',
};

const SOUND_VOLUMES: Record<SoundEffect, number> = {
  cardPlay: 0.55,
  cardSelect: 0.42,
  negri: 0.5,
  shuffle: 0.45,
};

interface WebSoundEffectsPlayerOptions {
  documentRef?: Document;
  fetchImpl?: typeof fetch;
  createAudioContext?: () => AudioContext;
}

export class WebSoundEffectsPlayer {
  private readonly documentRef: Document;
  private readonly fetchImpl: typeof fetch;
  private readonly createAudioContext: () => AudioContext;
  private readonly encodedSources = new Map<
    SoundEffect,
    Promise<ArrayBuffer | null>
  >();
  private readonly buffers = new Map<SoundEffect, AudioBuffer>();
  private context: AudioContext | null = null;
  private decodePromise: Promise<void> | null = null;
  private enabled = true;
  private started = false;
  private disposed = false;

  constructor(options: WebSoundEffectsPlayerOptions = {}) {
    this.documentRef = options.documentRef ?? document;
    this.fetchImpl =
      options.fetchImpl ??
      ((input, init) => window.fetch(input, init));
    this.createAudioContext =
      options.createAudioContext ?? (() => new AudioContext());
  }

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;

    for (const [effect, url] of Object.entries(SOUND_URLS) as [
      SoundEffect,
      string,
    ][]) {
      this.encodedSources.set(
        effect,
        this.fetchImpl(url)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to preload sound effect: ${url}`);
            }
            return response.arrayBuffer();
          })
          .catch(() => null),
      );
    }

    this.documentRef.addEventListener('pointerdown', this.handleUnlock, {
      passive: true,
    });
    this.documentRef.addEventListener('keydown', this.handleUnlock);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  play(effect: SoundEffect): void {
    if (
      !this.enabled ||
      this.disposed ||
      this.documentRef.visibilityState === 'hidden' ||
      this.context?.state !== 'running'
    ) {
      return;
    }

    const buffer = this.buffers.get(effect);
    if (!buffer) return;

    try {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      gain.gain.value = SOUND_VOLUMES[effect];
      source.connect(gain);
      gain.connect(this.context.destination);
      source.start();
    } catch {
      // Sound effects are optional feedback and must never interrupt gameplay.
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.documentRef.removeEventListener('pointerdown', this.handleUnlock);
    this.documentRef.removeEventListener('keydown', this.handleUnlock);
    this.encodedSources.clear();
    this.buffers.clear();
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }

  private readonly handleUnlock = (): void => {
    void this.unlock();
  };

  private async unlock(): Promise<void> {
    if (this.disposed) return;

    try {
      this.context ??= this.createAudioContext();
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      if (this.context.state !== 'running') return;

      this.documentRef.removeEventListener('pointerdown', this.handleUnlock);
      this.documentRef.removeEventListener('keydown', this.handleUnlock);
      await this.decodeSources();
    } catch {
      // Browsers may reject audio startup. A later gesture can retry it.
    }
  }

  private async decodeSources(): Promise<void> {
    if (this.decodePromise) return this.decodePromise;
    const context = this.context;
    if (!context) return;

    this.decodePromise = Promise.all(
      [...this.encodedSources.entries()].map(async ([effect, encoded]) => {
        const data = await encoded;
        if (!data || this.disposed) return;

        try {
          const buffer = await context.decodeAudioData(data.slice(0));
          if (!this.disposed) this.buffers.set(effect, buffer);
        } catch {
          // A broken asset must not prevent the remaining effects from loading.
        }
      }),
    )
      .then(() => undefined);

    return this.decodePromise;
  }
}
