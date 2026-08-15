import { asSeatId } from '../../types/identity.types';
import { ModeratePlayerUseCase } from '../moderate-player.use-case';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { ILeaveRoomUseCase } from '../interfaces/leave-room.use-case.interface';
import { RoomStatus } from '../../types/room.types';

describe('ModeratePlayerUseCase', () => {
  const createRoom = () => ({
    id: 'room-1',
    hostSeatId: asSeatId('host'),
    status: RoomStatus.PLAYING,
    players: [
      {
        seatId: asSeatId('host'),
        isCOM: false,
        socketId: 'host-socket',
        name: 'Host',
        hand: [],
        team: 0,
        isPasser: false,
      },
      {
        seatId: asSeatId('target'),
        isCOM: false,
        socketId: '',
        name: 'Target',
        hand: [],
        team: 1,
        isPasser: false,
      },
    ],
  });

  it('replaces idle or disconnected players with COM', async () => {
    const clearDisconnectTimeout = jest.fn();
    const blowState = {
      currentTrump: null,
      currentHighestDeclaration: {
        seatId: asSeatId('com-target'),
        trumpType: 'herz',
        numberOfPairs: 7,
        timestamp: 1,
      },
      declarations: [],
      actionHistory: [],
      lastPasserSeatId: null,
      isRoundCancelled: false,
      currentBlowIndex: 0,
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(createRoom()),
      getRoomGameState: jest.fn().mockResolvedValue({
        getState: () => ({
          players: [
            {
              seatId: asSeatId('target'),
              name: 'Target',
              hand: [],
              team: 1,
              isPasser: false,
            },
          ],
          blowState,
        }),
        getPlayerConnectionState: () => ({ socketId: '' }),
        clearDisconnectTimeout,
      }),
      convertPlayerToCOM: jest.fn().mockResolvedValue(true),
      listRooms: jest.fn().mockResolvedValue([]),
    } as Partial<IRoomService> as IRoomService;
    const leaveRoomUseCase = {
      execute: jest.fn(),
    } as unknown as ILeaveRoomUseCase;
    const useCase = new ModeratePlayerUseCase(roomService, leaveRoomUseCase);

    const result = await useCase.execute({
      roomId: 'room-1',
      requesterSeatId: asSeatId('host'),
      targetSeatId: asSeatId('target'),
      action: 'replace-with-com',
      isPlayerIdle: false,
    });

    expect(result).toEqual(
      expect.objectContaining({ success: true, mode: 'replace-with-com' }),
    );
    if (result.success && result.mode === 'replace-with-com') {
      expect(result.blowState).toBe(blowState);
    }
    expect(roomService.convertPlayerToCOM).toHaveBeenCalledWith(
      'room-1',
      'target',
    );
    expect(clearDisconnectTimeout).toHaveBeenCalledWith('target');
  });
});
