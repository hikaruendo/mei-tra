import { CardService } from '../card.service';
import { BlowService } from '../blow.service';
import { PlayService } from '../play.service';
import { ScoreService } from '../score.service';
import { ChomboService } from '../chombo.service';
import { DomainPlayer, Field } from '../../types/game.types';

describe('Rule service characterization', () => {
  const cardService = new CardService();
  const blowService = new BlowService(cardService);
  const playService = new PlayService(cardService);
  const scoreService = new ScoreService();
  const chomboService = new ChomboService(playService);

  it('builds a 41-card play deck and a 12-card scoring deck', () => {
    expect(cardService.generateDeck()).toHaveLength(41);
    expect(cardService.generateScoringCards()).toHaveLength(12);
  });

  it('orders declarations by pairs first and trump strength second', () => {
    const currentHighest = blowService.createDeclaration('p1', 'club', 7);
    expect(
      blowService.isValidDeclaration(
        { trumpType: 'herz', numberOfPairs: 7 },
        currentHighest,
      ),
    ).toBe(true);
    expect(
      blowService.isValidDeclaration(
        { trumpType: 'zuppe', numberOfPairs: 6 },
        currentHighest,
      ),
    ).toBe(false);
  });

  it('determines field winner using dealer-relative play order', () => {
    const players = [
      { playerId: 'p1', name: 'A', team: 0 },
      { playerId: 'p2', name: 'B', team: 1 },
      { playerId: 'p3', name: 'C', team: 0 },
      { playerId: 'p4', name: 'D', team: 1 },
    ].map(
      (player) =>
        ({
          ...player,
          hand: [],
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
        }) as DomainPlayer,
    );
    const field: Field = {
      cards: ['10♠', 'A♠', 'J♣', 'K♠'],
      playedBy: ['p1', 'p2', 'p3', 'p4'],
      baseCard: '10♠',
      dealerId: 'p1',
      isComplete: false,
    };

    expect(
      playService.determineFieldWinner(field, players, 'club')?.playerId,
    ).toBe('p3');
  });

  it('updates team score records using remembered tens before new cards', () => {
    const updated = scoreService.updateTeamScore(0, 13, {
      cards: [],
      rememberedTen: 1,
    });

    expect(updated.rememberedTen).toBe(0);
    expect(updated.cards).toEqual([
      expect.objectContaining({ value: 3, suit: '♥', isFaceUp: true }),
    ]);
  });

  it('records and reports chombo violations across teams only', () => {
    const player = {
      playerId: 'p1',
      name: 'A',
      team: 0,
      hand: ['J♠', 'J♣', 'J♥', 'J♦'],
      isPasser: false,
      hasBroken: false,
      hasRequiredBroken: false,
    } as DomainPlayer;

    const violation = chomboService.checkViolations('p1', 'check-four-jack', {
      player,
      hasBroken: false,
    });
    expect(violation?.type).toBe('four-jack');
    expect(
      chomboService.reportViolation('ally', 'p1', 'four-jack', 0, 0),
    ).toBeNull();
    expect(
      chomboService.reportViolation('enemy', 'p1', 'four-jack', 1, 0),
    ).toEqual(expect.objectContaining({ reportedBy: 'enemy' }));
  });
});
