import { BlowService } from '../blow.service';
import { CardService } from '../card.service';
import { ComStrategyService } from '../com-strategy.service';
import { PlayService } from '../play.service';
import {
  BlowState,
  DomainPlayer,
  Field,
  GamePhase,
  GameState,
  PlayState,
  Team,
  TrumpType,
} from '../../types/game.types';

describe('ComStrategyService', () => {
  const cardService = new CardService();
  const blowService = new BlowService(cardService);
  const playService = new PlayService(cardService);
  const strategy = new ComStrategyService(
    cardService,
    playService,
    blowService,
  );

  const player = (
    playerId: string,
    team: Team,
    hand: string[] = [],
    overrides: Partial<DomainPlayer> = {},
  ): DomainPlayer => ({
    playerId,
    name: playerId,
    team,
    hand,
    isPasser: false,
    hasBroken: false,
    hasRequiredBroken: false,
    ...overrides,
  });

  const state = (overrides: Partial<GameState> = {}): GameState => {
    const players = overrides.players ?? [
      player('com-0', 0, [], { isCOM: true }),
      player('enemy-1', 1),
      player('partner-0', 0),
      player('enemy-2', 1),
    ];

    const blowState: BlowState = {
      currentTrump: null,
      currentHighestDeclaration: null,
      declarations: [],
      actionHistory: [],
      lastPasser: null,
      isRoundCancelled: false,
      currentBlowIndex: 0,
      ...overrides.blowState,
    };

    return {
      currentPlayerIndex: 0,
      gamePhase: 'blow' as GamePhase,
      deck: [],
      teamScores: {
        0: { play: 0, total: 0 },
        1: { play: 0, total: 0 },
      },
      teamScoreRecords: { 0: [], 1: [] },
      playState: overrides.playState,
      roundNumber: 1,
      pointsToWin: 5,
      teamAssignments: Object.fromEntries(
        players.map((statePlayer) => [statePlayer.playerId, statePlayer.team]),
      ),
      ...overrides,
      players,
      blowState,
    };
  };

  it('declares with a strong hand instead of always passing', () => {
    const com = player(
      'com-0',
      0,
      ['JOKER', 'J♥', 'J♦', 'A♥', 'K♥', 'Q♥', '10♥', 'A♠', '5♣', '6♦'],
      { isCOM: true },
    );
    const gameState = state({
      players: [com, player('e1', 1), player('p1', 0), player('e2', 1)],
    });

    const action = strategy.chooseBlowAction(gameState, com);

    expect(action.type).toBe('declare');
    if (action.type === 'declare') {
      expect(action.declaration.numberOfPairs).toBeGreaterThanOrEqual(6);
    }
  });

  it('passes with weak or broken hands', () => {
    const weakCom = player(
      'com-0',
      0,
      ['5♠', '6♠', '7♣', '8♣', '9♦', '10♦', '5♥', '6♥', '7♥', '8♠'],
      { isCOM: true },
    );
    const brokenCom = { ...weakCom, hasBroken: true };

    expect(
      strategy.chooseBlowAction(state({ players: [weakCom] }), weakCom),
    ).toEqual({
      type: 'pass',
    });
    expect(
      strategy.chooseBlowAction(state({ players: [brokenCom] }), brokenCom),
    ).toEqual({
      type: 'pass',
    });
  });

  it('does not overcall a partner declaration without a clear upgrade', () => {
    const com = player(
      'com-0',
      0,
      ['A♥', 'K♥', 'Q♣', '10♣', '9♠', '8♠', '7♦', '6♦', '5♣', '5♥'],
      { isCOM: true },
    );
    const partner = player('partner-0', 0);
    const gameState = state({
      players: [com, player('e1', 1), partner, player('e2', 1)],
      blowState: {
        currentHighestDeclaration: {
          playerId: partner.playerId,
          trumpType: 'club',
          numberOfPairs: 6,
          timestamp: Date.now(),
        },
      } as Partial<BlowState> as BlowState,
    });

    expect(strategy.chooseBlowAction(gameState, com)).toEqual({ type: 'pass' });
  });

  it('selects low off-trump negri and avoids Joker, jacks, and high trump', () => {
    const com = player(
      'com-0',
      0,
      ['JOKER', 'J♥', 'J♦', 'A♥', 'K♠', '5♣', '6♥'],
      { isCOM: true },
    );
    const gameState = state({
      blowState: {
        currentTrump: 'herz',
        currentHighestDeclaration: {
          playerId: com.playerId,
          trumpType: 'herz',
          numberOfPairs: 6,
          timestamp: Date.now(),
        },
      } as Partial<BlowState> as BlowState,
    });

    expect(strategy.chooseNegriCard(gameState, com)).toBe('5♣');
  });

  it('does not waste a winner when the partner is already winning the field', () => {
    const field: Field = {
      cards: ['A♠', 'K♠'],
      playedBy: ['partner-0', 'enemy-1'],
      baseCard: 'A♠',
      dealerId: 'partner-0',
      isComplete: false,
    };
    const com = player('com-0', 0, ['5♠', 'JOKER', 'K♥'], { isCOM: true });
    const gameState = playState(field, com, 'club');

    expect(strategy.choosePlayCard(gameState, com)).toBe('5♠');
  });

  it('beats an opponent with the cheapest winning legal card', () => {
    const field: Field = {
      cards: ['K♠'],
      playedBy: ['enemy-1'],
      baseCard: 'K♠',
      dealerId: 'enemy-1',
      isComplete: false,
    };
    const com = player('com-0', 0, ['A♠', '5♠', 'JOKER'], { isCOM: true });
    const gameState = playState(field, com, 'club');

    expect(strategy.choosePlayCard(gameState, com)).toBe('A♠');
  });

  it('throws the lowest discard when it cannot win the field', () => {
    const field: Field = {
      cards: ['K♠'],
      playedBy: ['enemy-1'],
      baseCard: 'K♠',
      dealerId: 'enemy-1',
      isComplete: false,
    };
    const com = player('com-0', 0, ['5♣', '6♦', 'Q♥'], { isCOM: true });
    const gameState = playState(field, com, 'club');

    expect(strategy.choosePlayCard(gameState, com)).toBe('5♣');
  });

  it('selects the strongest supported suit after leading Joker', () => {
    const com = player('com-0', 0, ['A♣', 'K♣', '5♣', 'A♠', '6♥'], {
      isCOM: true,
    });
    const gameState = state({
      players: [com, player('e1', 1), player('p1', 0), player('e2', 1)],
      blowState: { currentTrump: 'club' } as Partial<BlowState> as BlowState,
    });

    expect(strategy.chooseBaseSuit(gameState, com)).toBe('♣');
  });

  function playState(
    field: Field,
    com: DomainPlayer,
    trump: TrumpType | null,
  ): GameState {
    const players = [
      com,
      player('enemy-1', 1),
      player('partner-0', 0),
      player('enemy-2', 1),
    ];
    const playStateValue: PlayState = {
      currentField: field,
      negriCard: null,
      neguri: {},
      fields: [],
      lastWinnerId: null,
      openDeclared: false,
      openDeclarerId: null,
    };

    return state({
      players,
      gamePhase: 'play',
      blowState: { currentTrump: trump } as Partial<BlowState> as BlowState,
      playState: playStateValue,
    });
  }
});
