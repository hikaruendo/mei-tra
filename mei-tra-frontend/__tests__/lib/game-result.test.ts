import { asSeatId } from '@contracts/ids';
import {
  buildGameResultSnapshot,
  resolveWinningTeam,
} from '@meitra/game-client/game-result';

const players = [
  { socketId: 's1', seatId: asSeatId('seat-1'), name: 'Alice', team: 0 as const, hand: [] },
  { socketId: 's2', seatId: asSeatId('seat-2'), name: 'ボブ', team: 0 as const, hand: [], isCOM: true },
  { socketId: 's3', seatId: asSeatId('seat-3'), name: 'Carol', team: 1 as const, hand: [] },
  { socketId: 's4', seatId: asSeatId('seat-4'), name: 'Dave', team: 1 as const, hand: [] },
];

describe('game result snapshot', () => {
  const payload = {
    winner: 'legacy text is ignored',
    winningTeam: 1 as const,
    finalScores: { 0: { play: 1, total: 3 }, 1: { play: 2, total: 5 } },
  };

  it('puts the winning team first and captures names before room teardown', () => {
    const result = buildGameResultSnapshot({
      payload,
      players,
      viewerSeatId: asSeatId('seat-3'),
      isSpectator: false,
      teamNames: { 1: '月' },
      token: 7,
    });
    expect(result).toMatchObject({
      winningTeam: 1,
      viewerRole: 'winner',
      token: 7,
      teams: [
        { team: 1, total: 5, members: [{ name: 'Carol', initial: 'C' }, { name: 'Dave', initial: 'D' }] },
        { team: 0, total: 3, members: [{ name: 'Alice', initial: 'A' }, { name: 'ボブ', initial: 'ボ', isCOM: true }] },
      ],
    });
  });

  it('classifies losing players and spectators independently', () => {
    expect(buildGameResultSnapshot({ payload, players, viewerSeatId: 'seat-1', isSpectator: false, token: 1 })?.viewerRole).toBe('loser');
    expect(buildGameResultSnapshot({ payload, players, viewerSeatId: 'seat-3', isSpectator: true, token: 2 })?.viewerRole).toBe('spectator');
  });

  it('supports the legacy winner string and rejects unknown winners', () => {
    expect(resolveWinningTeam({ winner: 'Team 0' })).toBe(0);
    expect(resolveWinningTeam({ winner: 'Team 1', winningTeam: 0 })).toBe(0);
    expect(resolveWinningTeam({ winner: 'red team' })).toBeNull();
  });
});
