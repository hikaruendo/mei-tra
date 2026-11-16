import { createComAutoPlayUseCase } from './com-autoplay.fixture';
import { RoomStatus } from '../../types/room.types';
import { asSeatId } from '../../types/identity.types';

const buildUseCase = (ownerConnected: boolean) => {
  const getCurrentPlayer = jest.fn().mockReturnValue({
    seatId: asSeatId('com'),
    isCOM: true,
  });
  const roomGameState = {
    getState: () => ({
      gamePhase: 'play',
      gameOver: null,
      pendingBrokenHandReveal: null,
      players: [],
    }),
    getCurrentPlayer,
    getPlayerConnectionState: (seatId: string) =>
      ownerConnected && seatId === 'mine' ? { socketId: 'socket-mine' } : null,
  };
  const roomService = {
    getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
    getRoom: jest.fn().mockResolvedValue({
      id: 'room-1',
      status: RoomStatus.PLAYING,
      hostSeatId: asSeatId('mine'),
      players: [
        { seatId: asSeatId('mine'), isCOM: false, userId: 'user-mine' },
        { seatId: asSeatId('com'), isCOM: true, userId: null },
      ],
    }),
  };
  const useCase = createComAutoPlayUseCase(roomService, () => false);
  return { useCase, getCurrentPlayer };
};

describe('ComAutoPlayUseCase while the seat owner is away', () => {
  it('holds the game until the owner comes back', async () => {
    const { useCase, getCurrentPlayer } = buildUseCase(false);

    const result = await useCase.execute({ roomId: 'room-1' });

    expect(result).toEqual({
      success: true,
      events: [],
      shouldContinue: false,
    });
    expect(getCurrentPlayer).not.toHaveBeenCalled();
  });

  it('goes on to the turn once the owner is back', async () => {
    const { useCase, getCurrentPlayer } = buildUseCase(true);

    await useCase.execute({ roomId: 'room-1' });

    expect(getCurrentPlayer).toHaveBeenCalled();
  });
});
