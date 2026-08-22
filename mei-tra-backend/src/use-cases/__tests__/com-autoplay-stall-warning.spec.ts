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
    currentSeatId: options.currentPlayer?.seatId ?? null,
    gamePhase: 'play',
    pendingBrokenHandReveal: null,
    blowState: { currentHighestDeclaration: null },
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
  const comStrategyService = {
    choosePlayCard: jest.fn(() => '9♣'),
  };
  const playCardUseCase = {
    execute: jest.fn().mockResolvedValue({ success: true, events: [] }),
  };

  const useCase = new ComAutoPlayUseCase(
    roomService as never,
    { isComPlayer: () => false } as never,
    comStrategyService as never,
    playCardUseCase as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return { useCase, comStrategyService, playCardUseCase };
};

describe('ComAutoPlayUseCase disconnected turn control', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('stays silent when the turn belongs to a connected human', async () => {
    const { useCase, playCardUseCase } = buildUseCase({
      connected: true,
      currentPlayer: HUMAN,
    });

    const result = await useCase.execute({ roomId: 'room-1' });

    expect(result.success).toBe(true);
    expect(result.shouldContinue).toBe(false);
    expect(playCardUseCase.execute).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('auto-plays a disconnected human without converting the seat to COM', async () => {
    const { useCase, comStrategyService, playCardUseCase } = buildUseCase({
      connected: false,
      currentPlayer: HUMAN,
    });

    const result = await useCase.execute({ roomId: 'room-1' });

    expect(result.success).toBe(true);
    expect(result.shouldContinue).toBe(true);
    expect(comStrategyService.choosePlayCard).toHaveBeenCalledWith(
      expect.anything(),
      HUMAN,
    );
    expect(playCardUseCase.execute).toHaveBeenCalledWith({
      roomId: 'room-1',
      actorId: HUMAN.seatId,
      card: '9♣',
    });
    expect(HUMAN.isCOM).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when no current player can be resolved at all', async () => {
    const { useCase } = buildUseCase({
      connected: false,
      currentPlayer: null,
    });

    await useCase.execute({ roomId: 'room-1' });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('no current player resolved');
  });
});
