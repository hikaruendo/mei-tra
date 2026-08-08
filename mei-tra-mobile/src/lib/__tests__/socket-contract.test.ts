import type {
  ChangePlayerTeamPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  ModeratePlayerPayload,
  NameUpdatedPayload,
  RoomActionPayload,
} from '@meitra/contracts/socket';

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
      targetPlayerId: 'player-2',
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
      targetPlayerId: 'player-2',
      action: 'remove',
    });
  });

  it('models name-updated as an explicit success or error union', () => {
    const successPayload: NameUpdatedPayload = {
      success: true,
      name: 'Player 1',
    };
    const errorPayload: NameUpdatedPayload = {
      success: false,
      error: 'Name updates not supported',
    };

    expect(successPayload.success).toBe(true);
    expect(errorPayload.success).toBe(false);
  });
});

const forbiddenJoinPayload: JoinRoomPayload = {
  roomId: 'room-1',
  // @ts-expect-error clients must not provide trusted join identity.
  user: {
    socketId: 'attacker-socket',
    playerId: 'victim-player',
    userId: 'victim-user',
    name: 'Victim',
    isAuthenticated: true,
  },
};
void forbiddenJoinPayload;

const forbiddenActionPayload: RoomActionPayload = {
  roomId: 'room-1',
  // @ts-expect-error clients must not provide trusted actor identity.
  playerId: 'victim-player',
};
void forbiddenActionPayload;

// @ts-expect-error name is required on successful name-updated payloads.
const forbiddenNamePayload: NameUpdatedPayload = { success: true };
void forbiddenNamePayload;
