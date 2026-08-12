import type {
  CompletedFieldContract,
} from '@meitra/contracts/game';
import { asSeatId } from '@meitra/contracts/ids';
import { normalizeCompletedFieldIdentity } from '@meitra/game-client/identity';

import {
  createEmptyBlowState,
  createEmptyScores,
  dedupeCompletedFields,
  mergePlayersByIdentity,
  normalizeGameStatePayload,
  resolvePlayerId,
  shouldAckTurn,
} from '@/lib/game-state';
import type { MobilePlayer } from '@/types/game';

const player = (
  playerId: string,
  overrides: Partial<MobilePlayer> = {},
): MobilePlayer => ({
  socketId: `socket-${playerId}`,
  seatId: asSeatId(playerId),
  playerId: asSeatId(playerId),
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
  winnerTeam: 0,
  dealerSeatId: asSeatId('player-2'),
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
    });

    expect(dedupeCompletedFields([first, duplicate, differentDealer])).toEqual([
      normalizeCompletedFieldIdentity(first),
      normalizeCompletedFieldIdentity(differentDealer),
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
      blowState: {
        currentTrump: 'club',
        currentHighestDeclaration: null,
        declarations: [],
        actionHistory: [],
        lastPasserSeatId: null,
        isRoundCancelled: false,
        currentBlowIndex: 0,
      },
      teamScores: { 0: { play: 1, total: 2 }, 1: { play: 0, total: 1 } },
      youSeatId: asSeatId('server-player'),
      isSpectator: false,
      negriCard: '5♣',
      negriSeatId: asSeatId('server-player'),
      revealedAgari: 'J♣',
      fields: [completedField(['J♠', 'Q♠']), completedField(['J♠', 'Q♠'])],
      hostSeatId: asSeatId('server-player'),
      pointsToWin: 5,
    });

    expect(snapshot.players).toEqual([expect.objectContaining({ playerId: 'server-player' })]);
    expect(snapshot.fields).toHaveLength(1);
    expect(snapshot.youSeatId).toBe('server-player');
    expect(snapshot.negriSeatId).toBe('server-player');
    expect(snapshot.revealedAgari).toBe('J♣');
  });

  it('resolves the current seat from game state before userId', () => {
    expect(
      resolvePlayerId(
        {
          roomId: 'room-1',
          players: [],
          gamePhase: 'waiting',
          currentField: null,
          currentTurnSeatId: null,
          blowState: {
            currentTrump: null,
            currentHighestDeclaration: null,
            declarations: [],
            actionHistory: [],
            lastPasserSeatId: null,
            lastPasser: null,
            isRoundCancelled: false,
            currentBlowIndex: 0,
          },
          teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
          youSeatId: asSeatId('player-from-state'),
          isSpectator: false,
          negriCard: null,
          negriSeatId: null,
          revealedAgari: null,
          fields: [],
          hostSeatId: null,
          pointsToWin: 5,
          paused: false,
          disconnectedPlayerIds: [],
          idlePlayerIds: [],
        },
        {
          id: 'room-1',
          name: 'room',
          hostSeatId: asSeatId('host'),
          hostId: asSeatId('host'),
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

  it('preserves canonical seat fields', () => {
    const snapshot = normalizeGameStatePayload({
      roomId: 'room-1',
      players: [player('canonical-seat')],
      gamePhase: 'blow',
      currentField: null,
      currentTurnSeatId: asSeatId('canonical-seat'),
      blowState: createEmptyBlowState(),
      teamScores: createEmptyScores(),
      youSeatId: asSeatId('canonical-seat'),
      isSpectator: false,
      negriCard: null,
      negriSeatId: null,
      fields: [],
      hostSeatId: asSeatId('canonical-seat'),
      pointsToWin: 5,
    });

    expect(snapshot.players[0].playerId).toBe('canonical-seat');
    expect(snapshot.currentTurnSeatId).toBe('canonical-seat');
    expect(snapshot.youSeatId).toBe('canonical-seat');
    expect(snapshot.hostSeatId).toBe('canonical-seat');
  });
});
