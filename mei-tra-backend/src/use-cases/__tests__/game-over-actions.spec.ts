import { asSeatId } from '../../types/identity.types';
import type { ChomboViolation, DomainPlayer } from '../../types/game.types';
import { ComAutoPlayUseCase } from '../com-autoplay.use-case';
import { createGame } from './chombo-game.fixture';

const winner = asSeatId('winner');
const comSeat = asSeatId('com');

const opponent: DomainPlayer = {
  seatId: asSeatId('opponent'),
  name: 'Opponent',
  team: 1,
  hand: ['A♥'],
  isPasser: false,
};
const com: DomainPlayer = {
  seatId: comSeat,
  name: 'COM',
  team: 1,
  hand: ['9♣'],
  isPasser: false,
  isCOM: true,
};

const wrongSuit: ChomboViolation = {
  type: 'wrong-suit',
  violatorSeatId: winner,
  timestamp: 1,
  reportedBySeatId: null,
  isExpired: false,
};

// A chombo report can end the game in the middle of a trick. The turn then
// still belongs to the COM that was about to play, and the room can ask that
// COM to act again after the game is over.
describe('Game actions after a chombo report ends the game', () => {
  let fixture: Awaited<ReturnType<typeof createGame>>;

  beforeEach(async () => {
    fixture = await createGame(
      ['A♠', 'K♠'],
      [
        { ...opponent, hand: [...opponent.hand] },
        { ...com, hand: [...com.hand] },
      ],
    );
    const state = fixture.game.getState();
    state.pointsToWin = 5;
    state.currentSeatId = comSeat;
    state.playState!.chomboRoundNumber = state.roundNumber;
    state.playState!.chomboViolations = [{ ...wrongSuit }];

    const reported = await fixture.report.execute({
      roomId: 'room-1',
      actorId: 'opponent',
      violatorSeatId: winner,
      violationType: 'wrong-suit',
    });

    expect(reported.gameOver).toEqual(
      expect.objectContaining({ winningTeam: 1 }),
    );
    expect(state.currentSeatId).toBe(comSeat);
  });

  afterEach(async () => {
    await fixture.module.close();
  });

  const loggedActionTypes = () =>
    fixture.loggedEvents.map((event) => event.actionType);

  it('rejects the card the COM was about to play', async () => {
    const result = await fixture.play.execute({
      roomId: 'room-1',
      actorId: 'com',
      card: '9♣',
    });

    expect(result).toEqual({
      success: false,
      error: 'The game is already over',
    });
    expect(fixture.game.getState().players[2].hand).toEqual(['9♣']);
    expect(loggedActionTypes()).not.toContain('card_played');
  });

  it('lets COM auto-play do nothing and stop', async () => {
    const comStrategyService = {
      chooseBlowAction: jest.fn(),
      chooseNegriCard: jest.fn(),
      choosePlayCard: jest.fn(() => '9♣'),
      chooseBaseSuit: jest.fn(),
    };
    const comAutoPlay = new ComAutoPlayUseCase(
      fixture.roomService as never,
      { isComPlayer: (player: DomainPlayer) => !!player.isCOM } as never,
      comStrategyService as never,
      fixture.play,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      {} as never,
      fixture.cards,
      { execute: jest.fn() } as never,
      { prepare: jest.fn(), finalize: jest.fn() } as never,
    );

    const result = await comAutoPlay.execute({ roomId: 'room-1' });

    expect(result).toEqual({
      success: true,
      events: [],
      shouldContinue: false,
    });
    expect(comStrategyService.choosePlayCard).not.toHaveBeenCalled();
    expect(fixture.game.getState().players[2].hand).toEqual(['9♣']);
    expect(loggedActionTypes()).not.toContain('card_played');
  });

  it('rejects an open', async () => {
    const result = await fixture.open.execute({
      roomId: 'room-1',
      actorId: 'winner',
    });

    expect(result).toEqual({
      success: false,
      error: 'Open is only available during play',
    });
    expect(fixture.game.getState().playState?.openDeclared).not.toBe(true);
  });
});
