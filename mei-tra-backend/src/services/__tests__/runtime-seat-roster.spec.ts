import { asSeatId } from '../../types/identity.types';
import {
  reconcileRuntimeRoster,
  upsertRuntimeSeat,
} from '../runtime-seat-roster';
import type { GameState } from '../../types/game.types';
import type { Room, RoomPlayer } from '../../types/room.types';

const roomPlayer = (overrides: Partial<RoomPlayer> = {}): RoomPlayer => ({
  seatId: asSeatId('seat-1'),
  socketId: 'socket-1',
  name: 'Player 1',
  hand: [],
  team: 0,
  isPasser: false,
  hasBroken: false,
  hasRequiredBroken: false,
  isReady: true,
  isHost: true,
  joinedAt: new Date(),
  ...overrides,
});

const room = (players: RoomPlayer[]): Pick<Room, 'players'> => ({ players });

const state = (): Pick<GameState, 'players' | 'teamAssignments'> => ({
  players: [
    {
      seatId: asSeatId('seat-1'),
      name: 'Player 1',
      hand: ['A♠'],
      team: 0,
      isPasser: true,
      hasBroken: true,
      hasRequiredBroken: false,
    },
  ],
  teamAssignments: { 'seat-1': 0 },
});

describe('runtime seat roster', () => {
  it('changes the occupant without changing the seat or gameplay state', () => {
    const runtimeRoom = room([roomPlayer()]);
    const runtimeState = state();

    const projection = upsertRuntimeSeat(
      runtimeRoom,
      runtimeState,
      roomPlayer({
        socketId: 'com-seat-1',
        name: 'COM',
        isCOM: true,
      }),
      { replaceSeatId: 'seat-1' },
    );

    expect(projection.roomPlayer).toMatchObject({
      seatId: asSeatId('seat-1'),
      name: 'COM',
      isCOM: true,
    });
    expect(projection.roomPlayer.hand).toEqual([]);
    expect(projection.roomPlayer.isPasser).toBe(false);
    expect(runtimeState.players[0]).toMatchObject({
      seatId: asSeatId('seat-1'),
      name: 'COM',
      isCOM: true,
      hand: ['A♠'],
      hasBroken: true,
    });
    expect(runtimeState.teamAssignments).toEqual({ 'seat-1': 0 });
  });

  it('rebuilds the game projection and team lookup from the room roster', () => {
    const runtimeState = state();
    const players = [
      roomPlayer({ name: 'Reconnected' }),
      roomPlayer({
        seatId: asSeatId('seat-2'),
        name: 'COM',
        team: 1,
        isCOM: true,
      }),
    ];

    reconcileRuntimeRoster(runtimeState, players);

    expect(runtimeState.players).toEqual([
      expect.objectContaining({
        seatId: asSeatId('seat-1'),
        name: 'Reconnected',
        hand: ['A♠'],
      }),
      expect.objectContaining({
        seatId: asSeatId('seat-2'),
        name: 'COM',
        team: 1,
      }),
    ]);
    expect(runtimeState.teamAssignments).toEqual({
      'seat-1': 0,
      'seat-2': 1,
    });
  });

  it('rejects replacing a seat with a different identity', () => {
    expect(() =>
      upsertRuntimeSeat(
        room([roomPlayer()]),
        state(),
        roomPlayer({
          seatId: asSeatId('seat-2'),
        }),
        { replaceSeatId: 'seat-1' },
      ),
    ).toThrow('Cannot replace seat seat-1 with a different seat seat-2');
  });
});
