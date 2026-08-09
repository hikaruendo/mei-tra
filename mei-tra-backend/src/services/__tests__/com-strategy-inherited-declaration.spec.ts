import { ComStrategyService } from '../com-strategy.service';
import { IBlowService } from '../interfaces/blow-service.interface';
import { ICardService } from '../interfaces/card-service.interface';
import { IPlayService } from '../interfaces/play-service.interface';
import { BlowDeclaration, DomainPlayer, GameState } from '../../types/game.types';

/**
 * A COM that replaces a human inherits that human's blow declaration — the
 * player-reference remap deliberately moves the bid to the seat.
 *
 * Both declare-blow and pass-blow reject a player who has already declared
 * (hasPlayerDeclaredInBlow), so such a seat has NO legal action. If the
 * strategy returns 'pass' there, ComAutoPlayRecoveryService retries the
 * rejected action forever and the table wedges — which is exactly what
 * happened in production.
 */
const comPlayer = (over: Partial<DomainPlayer> = {}): DomainPlayer =>
  ({
    playerId: 'com-timeout-0-123',
    name: 'COM',
    hand: ['A♠', 'K♠', 'Q♠', 'J♠', '10♠', '9♠', '8♠', '7♠', '6♠', '5♠'],
    team: 0,
    isPasser: false,
    isCOM: true,
    hasBroken: false,
    hasRequiredBroken: false,
    ...over,
  }) as DomainPlayer;

const declaration = (playerId: string): BlowDeclaration => ({
  playerId,
  trumpType: 'herz',
  numberOfPairs: 8,
  timestamp: 1,
});

const stateWith = (
  declarations: BlowDeclaration[],
  players: DomainPlayer[],
): GameState =>
  ({
    players,
    blowState: {
      currentTrump: null,
      currentHighestDeclaration: declarations[declarations.length - 1] ?? null,
      declarations,
      actionHistory: [],
      lastPasser: null,
      isRoundCancelled: false,
      currentBlowIndex: 0,
    },
  }) as unknown as GameState;

const buildService = () =>
  new ComStrategyService(
    {
      // Enough of the surface for evaluateHandForTrump to run on the
      // not-yet-declared control case.
      getCardSuit: (card: string) => card.slice(-1),
      getCardStrength: () => 1,
      generateDeck: () => [],
      compareCards: () => 0,
      generateScoringCards: () => [],
    } as unknown as ICardService,
    { getLegalPlayCards: jest.fn(() => []) } as unknown as IPlayService,
    { isValidDeclaration: () => true } as unknown as IBlowService,
  );

describe('ComStrategyService.chooseBlowAction — inherited declaration', () => {
  it('skips instead of passing when the seat has already declared', () => {
    const com = comPlayer();
    const service = buildService();

    const action = service.chooseBlowAction(
      stateWith([declaration(com.playerId)], [com]),
      com,
    );

    // 'pass' here is rejected by pass-blow and retried forever.
    expect(action.type).toBe('skip');
  });

  it('skips even when the hand is too weak to bid', () => {
    const com = comPlayer({ hand: ['5♠', '6♥', '7♦'] });
    const service = buildService();

    const action = service.chooseBlowAction(
      stateWith([declaration(com.playerId)], [com]),
      com,
    );

    expect(action.type).toBe('skip');
  });

  it('skips even when broken, which would otherwise pass', () => {
    const com = comPlayer({ hasBroken: true });
    const service = buildService();

    const action = service.chooseBlowAction(
      stateWith([declaration(com.playerId)], [com]),
      com,
    );

    expect(action.type).toBe('skip');
  });

  it('does not treat its own bid as a partner bid', () => {
    // Regression guard: currentHighestPlayer.team === comPlayer.team is true
    // for the COM itself, which made it "defer to its partner" and pass.
    const com = comPlayer();
    const service = buildService();
    const state = stateWith([declaration(com.playerId)], [com]);

    expect(service.chooseBlowAction(state, com).type).not.toBe('pass');
  });

  it('still acts normally when it has not declared', () => {
    const com = comPlayer();
    const partner = comPlayer({ playerId: 'com-1', team: 0 });
    const service = buildService();

    const action = service.chooseBlowAction(
      stateWith([declaration(partner.playerId)], [com, partner]),
      com,
    );

    expect(action.type).not.toBe('skip');
  });
});
