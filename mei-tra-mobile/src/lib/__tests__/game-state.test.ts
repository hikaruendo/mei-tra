import type {
  CompletedFieldContract,
  PlayerContract,
} from '@meitra/contracts/game';
import { asSeatId } from '@meitra/contracts/ids';

import {
  createEmptyBlowState,
  createEmptyScores,
  dedupeCompletedFields,
  mergePlayersByIdentity,
  normalizeGameStatePayload,
  resolvePlayerId,
  shouldAckTurn,
} from '@/lib/game-state';

const player = (
  playerId: string,
  overrides: Partial<PlayerContract> = {},
): PlayerContract => ({
  socketId: `socket-${playerId}`,
  seatId: asSeatId(playerId),
  playerId,
  name: playerId,
  userId: `user-${playerId}`,
  team: 0,
  hand: [],
  ...overrides,
});

const completedField = (
  cards: string[],
  overrides: Partial<CompletedFieldContract> = {},
): CompletedFieldContract => ({
  cards,
  winnerSeatId: asSeatId('player-1'),
  winnerId: 'player-1',
  winnerTeam: 0,
  dealerSeatId: asSeatId('player-2'),
  dealerId: 'player-2',
  ...overrides,
});

describe('mergePlayersByIdentity', () => {
  it('preserves user identity when a reconnect update omits userId', () => {
    expect(
      mergePlayersByIdentity(
        [player('player-1', { userId: 'user-1', name: 'Hikaru' })],
        [player('player-1', { userId: undefined, name: '' })],
      ),
    ).toEqual([
      expect.objectContaining({
        playerId: 'player-1',
        userId: 'user-1',
        name: 'Hikaru',
      }),
    ]);
  });

  it('does not graft human identity onto COM placeholders', () => {
    expect(
      mergePlayersByIdentity(
        [player('player-1', { userId: 'user-1', name: 'Hikaru' })],
        [player('player-1', { isCOM: true, userId: undefined, name: 'COM 1' })],
      ),
    ).toEqual([
      expect.objectContaining({
        playerId: 'player-1',
        userId: undefined,
        name: 'COM 1',
      }),
    ]);
  });
});

describe('dedupeCompletedFields', () => {
  it('removes duplicate field-complete echoes without dropping distinct dealers', () => {
    const first = completedField(['J♠', 'Q♠']);
    const duplicate = completedField(['J♠', 'Q♠']);
    const differentDealer = completedField(['J♠', 'Q♠'], {
      dealerSeatId: asSeatId('player-3'),
      dealerId: 'player-3',
    });

    expect(dedupeCompletedFields([first, duplicate, differentDealer])).toEqual([
      first,
      differentDealer,
    ]);
  });
});

describe('recovery helpers', () => {
  it('treats game-state as authoritative during resync', () => {
    const snapshot = normalizeGameStatePayload({
      roomId: 'room-1',
      players: [player('server-player')],
      gamePhase: 'play',
      currentField: null,
      currentTurnSeatId: asSeatId('server-player'),
      currentTurn: 'server-player',
      blowState: {
        currentTrump: 'club',
        currentHighestDeclaration: null,
        declarations: [],
        actionHistory: [],
        lastPasser: null,
        isRoundCancelled: false,
        currentBlowIndex: 0,
      },
      teamScores: { 0: { play: 1, total: 2 }, 1: { play: 0, total: 1 } },
      youSeatId: asSeatId('server-player'),
      you: 'server-player',
      isSpectator: false,
      negriCard: '5♣',
      negriSeatId: asSeatId('server-player'),
      negriPlayerId: 'stale-player',
      revealedAgari: 'J♣',
      fields: [completedField(['J♠', 'Q♠']), completedField(['J♠', 'Q♠'])],
      pointsToWin: 5,
    });

    expect(snapshot.players).toEqual([expect.objectContaining({ playerId: 'server-player' })]);
    expect(snapshot.fields).toHaveLength(1);
    expect(snapshot.you).toBe('server-player');
    expect(snapshot.youSeatId).toBe('server-player');
    expect(snapshot.negriSeatId).toBe('server-player');
    expect(snapshot.negriPlayerId).toBe('server-player');
    expect(snapshot.revealedAgari).toBe('J♣');
  });

  it('resolves the current player by playerId before userId', () => {
    expect(
      resolvePlayerId(
        {
          roomId: 'room-1',
          players: [],
          gamePhase: 'waiting',
          currentField: null,
          currentTurnSeatId: null,
          currentTurn: null,
          blowState: {
            currentTrump: null,
            currentHighestDeclaration: null,
            declarations: [],
            actionHistory: [],
            lastPasser: null,
            isRoundCancelled: false,
            currentBlowIndex: 0,
          },
          teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
          youSeatId: asSeatId('player-from-state'),
          you: 'player-from-state',
          isSpectator: false,
          negriCard: null,
          negriSeatId: null,
          negriPlayerId: null,
          revealedAgari: null,
          fields: [],
          hostSeatId: null,
          hostId: null,
          pointsToWin: 5,
          paused: false,
          disconnectedPlayerIds: [],
          idlePlayerIds: [],
        },
        {
          id: 'room-1',
          name: 'room',
          hostSeatId: asSeatId('host'),
          hostId: 'host',
          status: 'waiting',
          players: [
            {
              ...player('player-from-room', { userId: 'user-1' }),
              isReady: false,
              isHost: false,
              joinedAt: new Date(0).toISOString(),
            },
          ],
          settings: {
            maxPlayers: 4,
            isPrivate: false,
            password: null,
            teamAssignmentMethod: 'random',
            pointsToWin: 5,
            allowSpectators: true,
          },
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          lastActivityAt: new Date(0).toISOString(),
        },
        'user-1',
      ),
    ).toBe('player-from-state');
  });

  it('does not ack turns while disconnected from a game snapshot', () => {
    expect(shouldAckTurn(null, 'room-1')).toBe(false);
  });

  it('prefers canonical seat fields over legacy aliases', () => {
    const snapshot = normalizeGameStatePayload({
      roomId: 'room-1',
      players: [
        player('legacy-player', { seatId: asSeatId('canonical-seat') }),
      ],
      gamePhase: 'blow',
      currentField: null,
      currentTurnSeatId: asSeatId('canonical-seat'),
      currentTurn: 'legacy-player',
      blowState: createEmptyBlowState(),
      teamScores: createEmptyScores(),
      youSeatId: asSeatId('canonical-seat'),
      you: 'legacy-player',
      isSpectator: false,
      negriCard: null,
      fields: [],
      hostSeatId: asSeatId('canonical-seat'),
      hostId: 'legacy-player',
      pointsToWin: 5,
    });

    expect(snapshot.players[0].playerId).toBe('canonical-seat');
    expect(snapshot.currentTurn).toBe('canonical-seat');
    expect(snapshot.you).toBe('canonical-seat');
    expect(snapshot.hostId).toBe('canonical-seat');
  });

  it('falls back to legacy aliases when canonical fields are absent', () => {
    const snapshot = normalizeGameStatePayload({
      roomId: 'room-1',
      players: [player('legacy-player', { seatId: undefined })],
      gamePhase: 'blow',
      currentField: null,
      currentTurn: 'legacy-player',
      blowState: createEmptyBlowState(),
      teamScores: createEmptyScores(),
      you: 'legacy-player',
      isSpectator: false,
      negriCard: null,
      fields: [],
      hostId: 'legacy-player',
      pointsToWin: 5,
    });

    expect(snapshot.currentTurnSeatId).toBe('legacy-player');
    expect(snapshot.youSeatId).toBe('legacy-player');
    expect(snapshot.hostSeatId).toBe('legacy-player');
  });
});
