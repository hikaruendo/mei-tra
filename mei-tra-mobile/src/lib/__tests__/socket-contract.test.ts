import type {
  ChangePlayerTeamPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  ModeratePlayerPayload,
  RoomActionPayload,
} from '@meitra/contracts/socket';
import { asSeatId } from '@meitra/contracts/ids';

describe('socket contract client payload shapes', () => {
  it('keeps lobby action identity out of client payloads', () => {
    const joinPayload: JoinRoomPayload = { roomId: 'room-1' };
    const leavePayload: LeaveRoomPayload = { roomId: 'room-1' };
    const actionPayload: RoomActionPayload = { roomId: 'room-1' };
    const teamPayload: ChangePlayerTeamPayload = {
      roomId: 'room-1',
      teamChanges: { 'player-1': 1 },
    };
    const moderationPayload: ModeratePlayerPayload = {
      roomId: 'room-1',
      targetSeatId: asSeatId('player-2'),
      action: 'remove',
    };

    expect(joinPayload).toEqual({ roomId: 'room-1' });
    expect(leavePayload).toEqual({ roomId: 'room-1' });
    expect(actionPayload).toEqual({ roomId: 'room-1' });
    expect(teamPayload).toEqual({
      roomId: 'room-1',
      teamChanges: { 'player-1': 1 },
    });
    expect(moderationPayload).toEqual({
      roomId: 'room-1',
      targetSeatId: 'player-2',
      action: 'remove',
    });
  });
});

const forbiddenJoinPayload: JoinRoomPayload = {
  roomId: 'room-1',
  // @ts-expect-error clients must not provide trusted join identity.
  user: {
    socketId: 'attacker-socket',
    seatId: 'victim-player',
    userId: 'victim-user',
    name: 'Victim',
    isAuthenticated: true,
  },
};
void forbiddenJoinPayload;

const forbiddenActionPayload: RoomActionPayload = {
  roomId: 'room-1',
  // @ts-expect-error clients must not provide trusted actor identity.
  seatId: 'victim-player',
};
void forbiddenActionPayload;
