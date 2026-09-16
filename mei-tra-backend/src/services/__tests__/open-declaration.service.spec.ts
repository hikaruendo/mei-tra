import { CardService } from '../card.service';
import { PlayService } from '../play.service';
import { OpenDeclarationService } from '../open-declaration.service';
import { asSeatId } from '../../types/identity.types';
import type {
  DomainPlayer,
  GameState,
  TrumpType,
} from '../../types/game.types';

const player = (seatId: string, team: 0 | 1, hand: string[]): DomainPlayer => ({
  seatId: asSeatId(seatId),
  name: seatId,
  team,
  hand,
  isPasser: false,
});

const state = (
  players: DomainPlayer[],
  currentSeatId: string,
  currentTrump: TrumpType | null = null,
): GameState => ({
  players,
  currentSeatId: asSeatId(currentSeatId),
  gamePhase: 'play',
  deck: [],
  teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
  teamScoreRecords: { 0: [], 1: [] },
  blowState: {
    currentTrump,
    currentHighestDeclaration: null,
    declarations: [],
    actionHistory: [],
    lastPasserSeatId: null,
    isRoundCancelled: false,
    currentBlowIndex: 0,
  },
  playState: {
    currentField: {
      cards: [],
      playedBySeatIds: [],
      baseCard: '',
      dealerSeatId: asSeatId(currentSeatId),
      isComplete: false,
    },
    negriCard: null,
    negriSeatId: null,
    neguri: {},
    fields: [],
    openDeclared: false,
    openDeclarerSeatId: null,
  },
  roundNumber: 1,
  pointsToWin: 5,
});

describe('OpenDeclarationService', () => {
  const service = new OpenDeclarationService(
    new PlayService(new CardService()),
  );

  it('accepts an open when the declarer team can force every remaining trick', () => {
    const gameState = state(
      [
        player('declarer', 0, ['A♠']),
        player('partner', 0, ['K♠']),
        player('opponent-a', 1, ['Q♥']),
        player('opponent-b', 1, ['J♥']),
      ],
      'declarer',
    );

    expect(service.canDeclareOpen(gameState, asSeatId('declarer'))).toBe(true);
  });

  it('rejects an open when the opposing team can take a remaining trick', () => {
    const gameState = state(
      [
        player('declarer', 0, ['5♠']),
        player('partner', 0, ['6♠']),
        player('opponent-a', 1, ['A♠']),
        player('opponent-b', 1, ['2♥']),
      ],
      'declarer',
    );

    expect(service.canDeclareOpen(gameState, asSeatId('declarer'))).toBe(false);
  });

  it('lets the Joker leader pick a base suit that strips the opponents', () => {
    // Without the base suit branch the opponents keep their diamonds through
    // the Joker trick and take the last one.
    const gameState = state(
      [
        player('declarer', 0, ['JOKER', '5♦']),
        player('opponent-a', 1, ['A♦', 'K♠']),
        player('partner', 0, ['6♣', '7♣']),
        player('opponent-b', 1, ['Q♦', '9♠']),
      ],
      'declarer',
    );

    expect(service.canDeclareOpen(gameState, asSeatId('declarer'))).toBe(true);
  });

  it('lets the Joker leader pick a base suit that strips a trump card', () => {
    const gameState = state(
      [
        player('declarer', 0, ['JOKER', '5♥']),
        player('opponent-a', 1, ['K♥', '9♠']),
        player('partner', 0, ['A♥', '2♣']),
        player('opponent-b', 1, ['Q♥', '3♣']),
      ],
      'declarer',
      'zuppe',
    );

    expect(service.canDeclareOpen(gameState, asSeatId('declarer'))).toBe(true);
  });

  it('rejects an open when no base suit choice strips the opponent winner', () => {
    const gameState = state(
      [
        player('declarer', 0, ['JOKER', '5♦']),
        player('opponent-a', 1, ['A♦', 'K♦']),
        player('partner', 0, ['6♣', '7♣']),
        player('opponent-b', 1, ['Q♠', '9♥']),
      ],
      'declarer',
    );

    expect(service.canDeclareOpen(gameState, asSeatId('declarer'))).toBe(false);
  });
});
