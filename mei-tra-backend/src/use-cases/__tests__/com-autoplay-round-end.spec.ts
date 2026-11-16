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

const buildUseCase = (options: { hostIsCom: boolean; status?: RoomStatus }) => {
  const state = {
    gamePhase: 'round-end',
    gameOver: null,
    pendingBrokenHandReveal: null,
    players: [],
  };
  const roomGameState = { getState: () => state };
  const room = {
    id: 'room-1',
    status: options.status ?? RoomStatus.PLAYING,
    hostSeatId: asSeatId('host'),
    players: [
      { seatId: asSeatId('host'), isCOM: options.hostIsCom, isHost: true },
      { seatId: asSeatId('other'), isCOM: true, isHost: false },
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

  it('does nothing once the room is no longer playing', async () => {
    await buildUseCase({
      hostIsCom: true,
      status: RoomStatus.FINISHED,
    }).execute({ roomId: 'room-1' });

    expect(mockedStartNextRound).not.toHaveBeenCalled();
  });
});
