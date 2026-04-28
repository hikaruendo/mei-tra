import { CardService } from '../card.service';
import { PlayService } from '../play.service';
import { DomainPlayer, Field } from '../../types/game.types';

describe('PlayService', () => {
  const playService = new PlayService(new CardService());

  const makePlayer = (playerId: string, isCOM = false): DomainPlayer => ({
    playerId,
    name: playerId,
    hand: [],
    team: isCOM ? 1 : 0,
    isPasser: false,
    isCOM,
  });

  it('treats A as stronger than 5 when the suit is the same', () => {
    const players = [
      makePlayer('player-1'),
      makePlayer('player-2'),
      makePlayer('player-3'),
      makePlayer('player-4'),
    ];

    const field: Field = {
      cards: ['5♣', 'A♣', 'K♣', '6♣'],
      playedBy: ['player-1', 'player-2', 'player-3', 'player-4'],
      baseCard: '5♣',
      dealerId: 'player-1',
      isComplete: true,
    };

    const winner = playService.determineFieldWinner(field, players, null);

    expect(winner?.playerId).toBe('player-2');
  });

  it('keeps COM seats in the play order when attributing cards to players', () => {
    const players = [
      makePlayer('player-1'),
      makePlayer('com-1', true),
      makePlayer('player-2'),
      makePlayer('com-2', true),
    ];

    const field: Field = {
      cards: ['5♣', 'A♣', '6♣', 'K♣'],
      playedBy: ['player-1', 'com-1', 'player-2', 'com-2'],
      baseCard: '5♣',
      dealerId: 'player-1',
      isComplete: true,
    };

    const winner = playService.determineFieldWinner(field, players, null);

    expect(winner?.playerId).toBe('com-1');
  });

  it('returns only base-suit cards when the hand can follow suit', () => {
    const field: Field = {
      cards: ['K♠'],
      playedBy: ['player-2'],
      baseCard: 'K♠',
      dealerId: 'player-2',
      isComplete: false,
    };

    expect(
      playService.getLegalPlayCards(['5♠', 'A♥'], field, 'club'),
    ).toEqual(['5♠']);
  });

  it('requires Joker in Tanzen when the hand has it', () => {
    const field: Field = {
      cards: [],
      playedBy: [],
      baseCard: '',
      dealerId: 'player-1',
      isComplete: false,
    };

    expect(
      playService.getLegalPlayCards(['JOKER', 'A♥'], field, 'club'),
    ).toEqual(['JOKER']);
    expect(
      playService.getCardPlayError(['JOKER', 'A♥'], field, 'club', 'A♥'),
    ).toContain('must play the Joker');
  });
});
