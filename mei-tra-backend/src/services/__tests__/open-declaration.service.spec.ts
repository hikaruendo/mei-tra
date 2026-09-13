import { CardService } from '../card.service';
import { PlayService } from '../play.service';
import { OpenDeclarationService } from '../open-declaration.service';
import { asSeatId } from '../../types/identity.types';
import type { DomainPlayer, GameState } from '../../types/game.types';

const player = (seatId: string, team: 0 | 1, hand: string[]): DomainPlayer => ({
  seatId: asSeatId(seatId),
  name: seatId,
  team,
  hand,
  isPasser: false,
});

const state = (players: DomainPlayer[], currentSeatId: string): GameState => ({
  players,
  currentSeatId: asSeatId(currentSeatId),
  gamePhase: 'play',
  deck: [],
  teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
  teamScoreRecords: { 0: [], 1: [] },
  blowState: {
    currentTrump: null,
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
});
