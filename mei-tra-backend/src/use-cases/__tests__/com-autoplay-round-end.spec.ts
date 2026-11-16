import { ComAutoPlayUseCase } from '../com-autoplay.use-case';
import {
  COM_HOST_ROUND_CONFIRM_DELAY_MS,
  startNextRound,
} from '../helpers/round-completion.helper';
import { RoomStatus } from '../../types/room.types';
import { asSeatId } from '../../types/identity.types';

jest.mock('../helpers/round-completion.helper', () => ({
  ...jest.requireActual<typeof import('../helpers/round-completion.helper')>(
    '../helpers/round-completion.helper',
  ),
  startNextRound: jest.fn(),
}));

const mockedStartNextRound = startNextRound as jest.MockedFunction<
  typeof startNextRound
>;

const buildUseCase = (options: {
  hostIsCom: boolean;
  status?: RoomStatus;
  hostUserId?: string;
  hostConnected?: boolean;
}) => {
  const state = {
    gamePhase: 'round-end',
    gameOver: null,
    pendingBrokenHandReveal: null,
    players: [],
  };
  const roomGameState = {
    getState: () => state,
    getPlayerConnectionState: (seatId: string) =>
      seatId === 'host' && (options.hostConnected ?? !options.hostIsCom)
        ? { socketId: 'socket-host' }
        : null,
  };
  const room = {
    id: 'room-1',
    status: options.status ?? RoomStatus.PLAYING,
    hostSeatId: asSeatId('host'),
    players: [
      {
        seatId: asSeatId('host'),
        isCOM: options.hostIsCom,
        isHost: true,
        userId: options.hostUserId ?? null,
      },
      { seatId: asSeatId('other'), isCOM: true, isHost: false, userId: null },
    ],
  };
  const roomService = {
    getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
    getRoom: jest.fn().mockResolvedValue(room),
  };

  return new ComAutoPlayUseCase(
    roomService as never,
    { isComPlayer: () => true } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
};

describe('ComAutoPlayUseCase at round end', () => {
  beforeEach(() => {
    mockedStartNextRound.mockReset();
    mockedStartNextRound.mockResolvedValue([
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'new-round-started',
        payload: {},
      },
    ]);
  });

  it('confirms the round for a COM host after leaving the results up', async () => {
    const result = await buildUseCase({ hostIsCom: true }).execute({
      roomId: 'room-1',
    });

    expect(mockedStartNextRound).toHaveBeenCalledTimes(1);
    expect(result.events).toEqual([]);
    expect(result.delayedEvents).toEqual([
      expect.objectContaining({
        event: 'new-round-started',
        delayMs: COM_HOST_ROUND_CONFIRM_DELAY_MS,
      }),
    ]);
  });

  it('waits for a human host to confirm', async () => {
    const result = await buildUseCase({ hostIsCom: false }).execute({
      roomId: 'room-1',
    });

    expect(mockedStartNextRound).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ success: true, events: [] }),
    );
    expect(result.delayedEvents).toBeUndefined();
  });

  it('leaves the results up while the person who owns the host seat is away', async () => {
    const result = await buildUseCase({
      hostIsCom: true,
      hostUserId: 'user-host',
    }).execute({ roomId: 'room-1' });

    expect(mockedStartNextRound).not.toHaveBeenCalled();
    expect(result.delayedEvents).toBeUndefined();
  });

  it('leaves the results up while the human host is disconnected', async () => {
    await buildUseCase({
      hostIsCom: false,
      hostUserId: 'user-host',
      hostConnected: false,
    }).execute({ roomId: 'room-1' });

    expect(mockedStartNextRound).not.toHaveBeenCalled();
  });

  it('does nothing once the room is no longer playing', async () => {
    await buildUseCase({
      hostIsCom: true,
      status: RoomStatus.FINISHED,
    }).execute({ roomId: 'room-1' });

    expect(mockedStartNextRound).not.toHaveBeenCalled();
  });
});
