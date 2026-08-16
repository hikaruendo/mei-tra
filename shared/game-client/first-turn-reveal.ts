export type JankenHand = 'rock' | 'scissors' | 'paper';

/** A pending game-start reveal, as clients track it between socket events. */
export interface FirstTurnReveal {
  roomId: string;
  seatId: string;
  /** Changes per game start so a rematch replays the reveal. */
  token: number;
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
  | 'draw'
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
  /** Seat that loses the janken and therefore blows first. */
  firstTurnSeatId: string;
}

export interface BuildFirstTurnRevealScriptParams {
  seatIds: readonly string[];
  firstTurnSeatId: string;
  /** Mixed into the seed so every client in the room renders the same hands. */
  roomId: string;
  reducedMotion?: boolean;
}

const HANDS: JankenHand[] = ['rock', 'scissors', 'paper'];

const BEATEN_BY: Record<JankenHand, JankenHand> = {
  rock: 'paper',
  scissors: 'rock',
  paper: 'scissors',
};

const STEP_DURATION_MS = {
  chant: 900,
  ready: 700,
  draw: 900,
  showdown: 800,
  result: 900,
} as const;

const REDUCED_MOTION_RESULT_MS = 1400;

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
 * Builds the "ジャンケンシュッシュ" reveal that lands on the seat the server
 * already chose. The loser blows first, so `firstTurnSeatId` gets the losing
 * hand and every other seat gets the single hand that beats it.
 *
 * Returns null when the animation cannot be rendered meaningfully; callers
 * should then apply the turn immediately with no animation.
 */
export function buildFirstTurnRevealScript({
  seatIds,
  firstTurnSeatId,
  roomId,
  reducedMotion = false,
}: BuildFirstTurnRevealScriptParams): FirstTurnRevealScript | null {
  if (seatIds.length < 2 || !seatIds.includes(firstTurnSeatId)) {
    return null;
  }

  const seed = hashSeed(`${roomId}:${firstTurnSeatId}`);
  const loserHand = HANDS[seed % HANDS.length];
  const winnerHand = BEATEN_BY[loserHand];
  const drawHand = HANDS[(seed >>> 8) % HANDS.length];

  const showdownHands: Record<string, JankenHand> = {};
  for (const seatId of seatIds) {
    showdownHands[seatId] = seatId === firstTurnSeatId ? loserHand : winnerHand;
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
          kind: 'draw',
          durationMs: STEP_DURATION_MS.draw,
          hands: uniformHands(seatIds, drawHand),
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
  };
}
