import { Logger } from '@nestjs/common';
import { ComAutoPlayUseCase } from '../com-autoplay.use-case';
import { DomainPlayer } from '../../types/game.types';
import { asSeatId } from '../../types/identity.types';

const HUMAN: DomainPlayer = {
  seatId: asSeatId('human-1'),
  name: 'Human',
  hand: ['9♣'],
  team: 0,
  isPasser: false,
  isCOM: false,
};

const buildUseCase = (options: {
  connected: boolean;
  currentPlayer: DomainPlayer | null;
}) => {
  const state = {
    players: [HUMAN],
    currentPlayerId: options.currentPlayer?.seatId ?? null,
    gamePhase: 'play',
    pendingBrokenHandReveal: null,
    playState: { currentField: null },
  };

  const roomGameState = {
    getState: () => state,
    getCurrentPlayer: () => options.currentPlayer,
    getPlayerConnectionState: () =>
      options.connected ? { socketId: 'socket-1' } : null,
  };

  const roomService = {
    getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
  };

  return new ComAutoPlayUseCase(
    roomService as never,
    { isComPlayer: () => false } as never,
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

describe('ComAutoPlayUseCase stall instrumentation', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('stays silent when the turn belongs to a connected human', async () => {
    const useCase = buildUseCase({ connected: true, currentPlayer: HUMAN });

    const result = await useCase.execute({ roomId: 'room-1' });

    expect(result.success).toBe(true);
    expect(result.shouldContinue).toBe(false);
    // A human's turn is ordinary — instrumentation must not add noise here.
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when the turn holder is neither a COM nor connected', async () => {
    const useCase = buildUseCase({ connected: false, currentPlayer: HUMAN });

    await useCase.execute({ roomId: 'room-1' });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Turn unplayable in room room-1');
    expect(warn.mock.calls[0][0]).toContain('human-1');
  });

  it('warns when no current player can be resolved at all', async () => {
    const useCase = buildUseCase({ connected: false, currentPlayer: null });

    await useCase.execute({ roomId: 'room-1' });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('no current player resolved');
  });
});
