import { isLastTanzenAwaitingReport } from './chombo-candidates';
import { asSeatId } from '../types/identity.types';
import type {
  ChomboViolation,
  DomainPlayer,
  GameState,
} from '../types/game.types';

const player = (
  seatId: string,
  team: 0 | 1,
  overrides: Partial<DomainPlayer> = {},
): DomainPlayer => ({
  seatId: asSeatId(seatId),
  name: seatId,
  team,
  hand: [],
  isPasser: false,
  ...overrides,
});

const lastTanzen = (
  overrides: Partial<ChomboViolation> = {},
): ChomboViolation => ({
  type: 'last-tanzen',
  violatorSeatId: asSeatId('violator'),
  timestamp: 1,
  reportedBySeatId: null,
  isExpired: false,
  ...overrides,
});

const tableState = ({
  players = [player('violator', 0), player('rival', 1)],
  candidates = [lastTanzen()],
}: {
  players?: DomainPlayer[];
  candidates?: ChomboViolation[];
} = {}) =>
  ({
    players,
    playState: { chomboViolations: candidates },
  }) as unknown as Pick<GameState, 'players' | 'playState'>;

describe('isLastTanzenAwaitingReport', () => {
  it('holds once the violator has played the Joker and a human can report it', () => {
    expect(isLastTanzenAwaitingReport(tableState())).toBe(true);
  });

  it('waits for the Joker to leave the violator hand', () => {
    const state = tableState({
      players: [player('violator', 0, { hand: ['JOKER'] }), player('rival', 1)],
    });
    expect(isLastTanzenAwaitingReport(state)).toBe(false);
  });

  it('skips a last tanzen that only COM seats could report', () => {
    const state = tableState({
      players: [
        player('violator', 0),
        player('partner', 0),
        player('rival', 1, { isCOM: true }),
        player('second-rival', 1, { isCOM: true }),
      ],
    });
    expect(isLastTanzenAwaitingReport(state)).toBe(false);
  });

  it('skips a last tanzen already reported or expired', () => {
    expect(
      isLastTanzenAwaitingReport(
        tableState({
          candidates: [lastTanzen({ reportedBySeatId: asSeatId('rival') })],
        }),
      ),
    ).toBe(false);
    expect(
      isLastTanzenAwaitingReport(
        tableState({ candidates: [lastTanzen({ isExpired: true })] }),
      ),
    ).toBe(false);
  });

  it('ignores other violations', () => {
    expect(
      isLastTanzenAwaitingReport(
        tableState({ candidates: [lastTanzen({ type: 'wrong-suit' })] }),
      ),
    ).toBe(false);
    expect(isLastTanzenAwaitingReport(tableState({ candidates: [] }))).toBe(
      false,
    );
  });
});
