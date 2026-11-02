import { rankedMatchAtGameOver } from './ranked-match';
import { GameState } from '../types/game.types';
import { Room } from '../types/room.types';

function room(mode: 'normal' | 'pro' = 'normal'): Room {
  return {
    settings: { gameMode: mode },
    players: [0, 1, 2, 3].map((index) => ({
      userId: `user-${index}`,
      team: index % 2,
      isCOM: false,
    })),
  } as Room;
}

const state = {
  rankingMatchId: 'match-1',
  rankingComParticipated: false,
} as GameState;

describe('rankedMatchAtGameOver', () => {
  it('records four human results in their game mode', () => {
    expect(rankedMatchAtGameOver(room('pro'), state, 0)).toEqual({
      matchId: 'match-1',
      mode: 'pro',
      players: [
        { userId: 'user-0', won: true },
        { userId: 'user-1', won: false },
        { userId: 'user-2', won: true },
        { userId: 'user-3', won: false },
      ],
    });
  });

  it('rejects any COM participation, even after the seat becomes human again', () => {
    expect(
      rankedMatchAtGameOver(
        room(),
        { ...state, rankingComParticipated: true },
        0,
      ),
    ).toBeNull();
    const currentCom = room();
    currentCom.players[1].isCOM = true;
    expect(rankedMatchAtGameOver(currentCom, state, 0)).toBeNull();
  });

  it('requires four distinct account identities and a new match ID', () => {
    const duplicate = room();
    duplicate.players[1].userId = duplicate.players[0].userId;
    expect(rankedMatchAtGameOver(duplicate, state, 0)).toBeNull();
    expect(
      rankedMatchAtGameOver(room(), { ...state, rankingMatchId: null }, 0),
    ).toBeNull();
  });
});
