import {
  buildFirstTurnRevealScript,
  hasBlowActivity,
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

describe('buildFirstTurnRevealScript', () => {
  it('is deterministic for the same room and first turn seat', () => {
    const first = buildFirstTurnRevealScript({
      seatIds: SEAT_IDS,
      firstTurnSeatId: 'seat-2',
      roomId: 'room-abc',
    });
    const second = buildFirstTurnRevealScript({
      seatIds: SEAT_IDS,
      firstTurnSeatId: 'seat-2',
      roomId: 'room-abc',
    });

    expect(first).toEqual(second);
  });

  it('gives the first turn seat the only losing hand', () => {
    for (const firstTurnSeatId of SEAT_IDS) {
      const script = buildFirstTurnRevealScript({
        seatIds: SEAT_IDS,
        firstTurnSeatId,
        roomId: 'room-abc',
      });
      const showdown = script?.steps.find((step) => step.kind === 'showdown');
      const hands = showdown?.hands;

      expect(hands).toBeDefined();
      const loserHand = hands![firstTurnSeatId];
      const winners = SEAT_IDS.filter((seatId) => seatId !== firstTurnSeatId);

      for (const seatId of winners) {
        expect(BEATS[hands![seatId]]).toBe(loserHand);
      }
    }
  });

  it('shows every seat the same hand on the draw step', () => {
    const script = buildFirstTurnRevealScript({
      seatIds: SEAT_IDS,
      firstTurnSeatId: 'seat-1',
      roomId: 'room-abc',
    });
    const draw = script?.steps.find((step) => step.kind === 'draw');
    const hands = Object.values(draw?.hands ?? {});

    expect(hands).toHaveLength(SEAT_IDS.length);
    expect(new Set(hands).size).toBe(1);
  });

  it('opens with every seat showing rock for the first shu', () => {
    const script = buildFirstTurnRevealScript({
      seatIds: SEAT_IDS,
      firstTurnSeatId: 'seat-1',
      roomId: 'room-abc',
    });
    const ready = script?.steps.find((step) => step.kind === 'ready');

    expect(Object.values(ready?.hands ?? {})).toEqual(
      SEAT_IDS.map(() => 'rock'),
    );
  });

  it('finishes within the server turn delay', () => {
    const script = buildFirstTurnRevealScript({
      seatIds: SEAT_IDS,
      firstTurnSeatId: 'seat-0',
      roomId: 'room-abc',
    });

    expect(script?.totalDurationMs).toBeLessThanOrEqual(
      GAME_START_TURN_REVEAL_DELAY_MS,
    );
  });

  it('collapses to a single result step when motion is reduced', () => {
    const script = buildFirstTurnRevealScript({
      seatIds: SEAT_IDS,
      firstTurnSeatId: 'seat-3',
      roomId: 'room-abc',
      reducedMotion: true,
    });

    expect(script?.steps.map((step) => step.kind)).toEqual(['result']);
    expect(script?.steps[0].hands?.['seat-3']).toBeDefined();
  });

  it('returns null when the first turn seat is not seated', () => {
    expect(
      buildFirstTurnRevealScript({
        seatIds: SEAT_IDS,
        firstTurnSeatId: 'seat-9',
        roomId: 'room-abc',
      }),
    ).toBeNull();
  });

  it('returns null when there are not enough seats', () => {
    expect(
      buildFirstTurnRevealScript({
        seatIds: ['seat-0'],
        firstTurnSeatId: 'seat-0',
        roomId: 'room-abc',
      }),
    ).toBeNull();
  });
});

describe('shouldAbortRevealOnTurn', () => {
  const reveal = { roomId: 'room-1', seatId: 'seat-2', token: 1 };

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
