import {
  buildFirstTurnRevealScript,
  hasBlowActivity,
  isFirstTurnRevealStale,
  resolveLastBlowSeatId,
  shouldAbortRevealOnTurn,
  type JankenHand,
} from '@meitra/game-client/first-turn-reveal';
import { GAME_START_TURN_REVEAL_DELAY_MS } from '@contracts/game';

const SEAT_IDS = ['seat-0', 'seat-1', 'seat-2', 'seat-3'];

const BEATS: Record<JankenHand, JankenHand> = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
};

const params = (overrides: Partial<Parameters<typeof buildFirstTurnRevealScript>[0]> = {}) => ({
  seatIds: SEAT_IDS,
  firstTurnSeatId: 'seat-2',
  lastBlowSeatId: 'seat-1',
  roomId: 'room-abc',
  ...overrides,
});

describe('resolveLastBlowSeatId', () => {
  it('returns the seat right before the first blower in blow order', () => {
    expect(resolveLastBlowSeatId(SEAT_IDS, 'seat-2')).toBe('seat-1');
  });

  it('wraps around when the first blower opens the roster', () => {
    expect(resolveLastBlowSeatId(SEAT_IDS, 'seat-0')).toBe('seat-3');
  });

  it('returns null when the seat is not in the roster', () => {
    expect(resolveLastBlowSeatId(SEAT_IDS, 'seat-9')).toBeNull();
    expect(resolveLastBlowSeatId(['seat-0'], 'seat-0')).toBeNull();
  });
});

describe('buildFirstTurnRevealScript', () => {
  it('is deterministic for the same room and first turn seat', () => {
    expect(buildFirstTurnRevealScript(params())).toEqual(
      buildFirstTurnRevealScript(params()),
    );
  });

  it('gives the last blower the only winning hand', () => {
    for (const firstTurnSeatId of SEAT_IDS) {
      const lastBlowSeatId = resolveLastBlowSeatId(SEAT_IDS, firstTurnSeatId)!;
      const script = buildFirstTurnRevealScript(
        params({ firstTurnSeatId, lastBlowSeatId }),
      );
      const showdown = script?.steps.find((step) => step.kind === 'showdown');
      const hands = showdown?.hands;

      expect(hands).toBeDefined();
      const winnerHand = hands![lastBlowSeatId];
      const losers = SEAT_IDS.filter((seatId) => seatId !== lastBlowSeatId);

      for (const seatId of losers) {
        expect(BEATS[winnerHand]).toBe(hands![seatId]);
      }
    }
  });

  it('opens with every seat showing rock for the first shu', () => {
    const script = buildFirstTurnRevealScript(params());
    const ready = script?.steps.find((step) => step.kind === 'ready');

    expect(Object.values(ready?.hands ?? {})).toEqual(
      SEAT_IDS.map(() => 'rock'),
    );
  });

  it('finishes before the earliest possible COM first action', () => {
    const script = buildFirstTurnRevealScript(params());

    // COM's first move fires no sooner than the turn delay + 100ms pacing
    // margin + a 2s think delay (COM_AUTO_PLAY_INITIAL_DELAY_MS); the reveal
    // must be gone by then or its ending would be cut short.
    expect(script?.totalDurationMs).toBeLessThan(
      GAME_START_TURN_REVEAL_DELAY_MS + 100 + 2_000,
    );
  });

  it('collapses to a single result step when motion is reduced', () => {
    const script = buildFirstTurnRevealScript(params({ reducedMotion: true }));

    expect(script?.steps.map((step) => step.kind)).toEqual(['result']);
    expect(script?.steps[0].hands?.['seat-1']).toBeDefined();
    expect(script?.lastBlowSeatId).toBe('seat-1');
    // Reduced motion holds the static result for the full script length so the
    // delayed turn indicator arrives right as it ends.
    expect(script?.totalDurationMs).toBe(
      buildFirstTurnRevealScript(params())?.totalDurationMs,
    );
  });

  it('marks a reveal stale once the animation window has long passed', () => {
    const token = 1_000_000;
    expect(isFirstTurnRevealStale({ token }, token + 4_200)).toBe(false);
    expect(isFirstTurnRevealStale({ token }, token + 60_000)).toBe(true);
  });

  it('returns null when either seat is missing or they collide', () => {
    expect(
      buildFirstTurnRevealScript(params({ firstTurnSeatId: 'seat-9' })),
    ).toBeNull();
    expect(
      buildFirstTurnRevealScript(params({ lastBlowSeatId: 'seat-9' })),
    ).toBeNull();
    expect(
      buildFirstTurnRevealScript(
        params({ firstTurnSeatId: 'seat-1', lastBlowSeatId: 'seat-1' }),
      ),
    ).toBeNull();
    expect(
      buildFirstTurnRevealScript(
        params({ seatIds: ['seat-0'], firstTurnSeatId: 'seat-0' }),
      ),
    ).toBeNull();
  });
});

describe('shouldAbortRevealOnTurn', () => {
  const reveal = {
    roomId: 'room-1',
    seatId: 'seat-2',
    lastBlowSeatId: 'seat-1',
    token: 1,
  };

  it('lets the reveal continue when the rebroadcast repeats its seat', () => {
    expect(shouldAbortRevealOnTurn(reveal, 'seat-2')).toBe(false);
  });

  it('aborts when the turn actually moved to another seat', () => {
    expect(shouldAbortRevealOnTurn(reveal, 'seat-0')).toBe(true);
  });

  it('does nothing without an active reveal', () => {
    expect(shouldAbortRevealOnTurn(null, 'seat-0')).toBe(false);
  });
});

describe('hasBlowActivity', () => {
  it('treats the empty rejoin rebroadcast as no activity', () => {
    expect(hasBlowActivity({ declarations: [] })).toBe(false);
    expect(hasBlowActivity({ declarations: [], actionHistory: [] })).toBe(
      false,
    );
  });

  it('detects a declaration', () => {
    expect(hasBlowActivity({ declarations: [{}] })).toBe(true);
  });

  it('detects a pass recorded only in the action history', () => {
    expect(
      hasBlowActivity({ declarations: [], actionHistory: [{}] }),
    ).toBe(true);
  });
});
