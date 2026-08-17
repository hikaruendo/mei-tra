export type JankenHand = 'rock' | 'scissors' | 'paper';

/** A pending game-start reveal, as clients track it between socket events. */
export interface FirstTurnReveal {
  roomId: string;
  /** Seat that blows first (the server-chosen turn holder). */
  seatId: string;
  /**
   * Seat that wins the janken and blows last (吹き上げ) — the seat right
   * before `seatId` in blow order, per the original rule that the winner
   * blows last and their neighbor opens.
   */
  lastBlowSeatId: string;
  /** Changes per game start so a rematch replays the reveal. */
  token: number;
}

/**
 * Derives the 吹き上げ seat from the first-turn seat: blow order walks the
 * roster array in order, so the last blower is the seat right before the
 * first. `seatIdsInBlowOrder` must be the `game-started` payload order (the
 * server roster order), not a display order. Returns null when the seat is
 * not in the roster.
 */
export function resolveLastBlowSeatId(
  seatIdsInBlowOrder: readonly string[],
  firstTurnSeatId: string,
): string | null {
  const count = seatIdsInBlowOrder.length;
  const firstIndex = seatIdsInBlowOrder.indexOf(firstTurnSeatId);
  if (count < 2 || firstIndex === -1) {
    return null;
  }
  return seatIdsInBlowOrder[(firstIndex - 1 + count) % count];
}

/**
 * Whether an incoming `update-turn` should cut the reveal short. A rejoining
 * player makes the server rebroadcast the current turn to the whole room;
 * repeating the seat the reveal is already walking toward is not progress.
 */
export function shouldAbortRevealOnTurn(
  reveal: FirstTurnReveal | null,
  seatId: string,
): boolean {
  return reveal !== null && reveal.seatId !== seatId;
}

/**
 * Whether a `blow-updated` payload represents actual blow-phase progress. The
 * empty state a rejoining player makes the server rebroadcast is not a
 * declaration, so it must not end the reveal.
 */
export function hasBlowActivity(payload: {
  declarations: readonly unknown[];
  actionHistory?: readonly unknown[];
}): boolean {
  return (
    payload.declarations.length > 0 || (payload.actionHistory?.length ?? 0) > 0
  );
}

export type FirstTurnRevealStepKind =
  | 'chant'
  | 'ready'
  | 'showdown'
  | 'result';

export interface FirstTurnRevealStep {
  kind: FirstTurnRevealStepKind;
  durationMs: number;
  /** Hand shown per seat, or null while no hand is revealed yet. */
  hands: Record<string, JankenHand> | null;
}

export interface FirstTurnRevealScript {
  steps: FirstTurnRevealStep[];
  totalDurationMs: number;
  /** Seat that blows first. */
  firstTurnSeatId: string;
  /** Seat that wins the janken and blows last (吹き上げ). */
  lastBlowSeatId: string;
}

export interface BuildFirstTurnRevealScriptParams {
  seatIds: readonly string[];
  firstTurnSeatId: string;
  /** The janken winner; see {@link resolveLastBlowSeatId}. */
  lastBlowSeatId: string;
  /** Mixed into the seed so every client in the room renders the same hands. */
  roomId: string;
  reducedMotion?: boolean;
}

/**
 * Line-art hand glyphs shared by Web (inline `<svg>`) and mobile
 * (react-native-svg). Each entry is a list of path `d` strings drawn in a
 * 64x64 viewBox, stroke-only with round caps/joins.
 */
export const JANKEN_HAND_PATHS: Record<JankenHand, string[]> = {
  rock: [
    'M14 22 h28 a9 9 0 0 1 9 9 v6 a17 17 0 0 1 -17 17 h-7 a15 15 0 0 1 -15 -15 z',
    'M23.5 22 v13 M32.5 22 v13 M41.5 22 v13',
    'M14 36 c4 9 12 13 21 13',
  ],
  scissors: [
    'M26 33 L18.5 11 a4 4 0 0 1 7.5 -2.6 L33 28',
    'M33 28 L43 8.5 a4 4 0 0 1 7.2 3.4 L41 33',
    'M23 31 a10 10 0 0 0 -7 10 c0 8 7 13 15 13 c8 0 14 -5 14 -12 a10 10 0 0 0 -4.5 -8.5',
  ],
  paper: [
    'M18 33 V16 a3.5 3.5 0 0 1 7 0 v15',
    'M25 31 V11 a3.5 3.5 0 0 1 7 0 v19',
    'M32 30 V10 a3.5 3.5 0 0 1 7 0 v21',
    'M39 32 V16 a3.5 3.5 0 0 1 7 0 v19',
    'M18 33 v7 c0 10 7 16 16 16 c9 0 12 -6 12 -14 v-7',
    'M18 38 c-4.5 -1 -7.5 -5.5 -5.5 -9.5 l3.5 -4',
  ],
};

const HANDS: JankenHand[] = ['rock', 'scissors', 'paper'];

/** The hand each hand defeats. */
const BEATS: Record<JankenHand, JankenHand> = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
};

// The chant marches at 60 BPM — one beat per second, like calling the janken
// out loud — and the result holds longest for reading time. The script may
// outlast the server's update-turn delay — the same-seat rebroadcast does not
// abort the reveal — but it must end before COM's earliest first action
// (delay + pacing + COM think time).
export const JANKEN_STEP_DURATION_MS = {
  chant: 1000,
  ready: 1000,
  showdown: 1000,
  result: 3000,
} as const;

const STEP_DURATION_MS = JANKEN_STEP_DURATION_MS;

// Reduced motion removes the motion, not the time: the static result holds
// for the full script length so the turn indicator arrives right as it ends
// instead of leaving seconds of turn-less UI.
const REDUCED_MOTION_RESULT_MS =
  STEP_DURATION_MS.chant +
  STEP_DURATION_MS.ready +
  STEP_DURATION_MS.showdown +
  STEP_DURATION_MS.result;

/**
 * Whether a tracked reveal is too old to still animate. Covers the client
 * that armed a reveal while no game screen was mounted (e.g. mobile user on
 * the room list): replaying a minutes-old janken would misrepresent a game
 * already in progress, so it should complete immediately instead.
 */
export function isFirstTurnRevealStale(
  reveal: Pick<FirstTurnReveal, 'token'>,
  now: number,
): boolean {
  return now - reveal.token > REDUCED_MOTION_RESULT_MS + 1_000;
}

function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function uniformHands(
  seatIds: readonly string[],
  hand: JankenHand,
): Record<string, JankenHand> {
  const hands: Record<string, JankenHand> = {};
  for (const seatId of seatIds) {
    hands[seatId] = hand;
  }
  return hands;
}

/**
 * Builds the "ジャンケンシュッシュ" reveal that lands on the outcome the
 * server already chose. Per the original rule the janken winner blows last
 * (吹き上げ), so `lastBlowSeatId` gets the one winning hand and every other
 * seat gets the hand it defeats; the first blower is the winner's neighbor.
 *
 * Returns null when the animation cannot be rendered meaningfully; callers
 * should then apply the turn immediately with no animation.
 */
export function buildFirstTurnRevealScript({
  seatIds,
  firstTurnSeatId,
  lastBlowSeatId,
  roomId,
  reducedMotion = false,
}: BuildFirstTurnRevealScriptParams): FirstTurnRevealScript | null {
  if (
    seatIds.length < 2 ||
    !seatIds.includes(firstTurnSeatId) ||
    !seatIds.includes(lastBlowSeatId) ||
    firstTurnSeatId === lastBlowSeatId
  ) {
    return null;
  }

  const seed = hashSeed(`${roomId}:${firstTurnSeatId}`);
  const winnerHand = HANDS[seed % HANDS.length];
  const loserHand = BEATS[winnerHand];

  const showdownHands: Record<string, JankenHand> = {};
  for (const seatId of seatIds) {
    showdownHands[seatId] = seatId === lastBlowSeatId ? winnerHand : loserHand;
  }

  const steps: FirstTurnRevealStep[] = reducedMotion
    ? [
        {
          kind: 'result',
          durationMs: REDUCED_MOTION_RESULT_MS,
          hands: showdownHands,
        },
      ]
    : [
        { kind: 'chant', durationMs: STEP_DURATION_MS.chant, hands: null },
        {
          kind: 'ready',
          durationMs: STEP_DURATION_MS.ready,
          hands: uniformHands(seatIds, 'rock'),
        },
        {
          kind: 'showdown',
          durationMs: STEP_DURATION_MS.showdown,
          hands: showdownHands,
        },
        {
          kind: 'result',
          durationMs: STEP_DURATION_MS.result,
          hands: showdownHands,
        },
      ];

  return {
    steps,
    totalDurationMs: steps.reduce((total, step) => total + step.durationMs, 0),
    firstTurnSeatId,
    lastBlowSeatId,
  };
}
