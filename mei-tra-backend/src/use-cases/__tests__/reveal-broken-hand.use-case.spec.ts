import { asSeatId } from '../../types/identity.types';
import { createGame } from './chombo-game.fixture';

describe('RevealBrokenHandUseCase table reveal', () => {
  it('shows the broken hand to the table until the redeal', async () => {
    const fixture = await createGame(['2♠', '3♠']);
    try {
      const state = fixture.game.getState();
      state.gamePhase = 'blow';
      state.players[0].hasBroken = true;

      const preparation = await fixture.broken.prepare({
        roomId: 'room-1',
        actorId: 'winner',
        seatId: asSeatId('winner'),
      });

      expect(preparation.events).toEqual([
        {
          scope: 'room',
          roomId: 'room-1',
          event: 'broken-hand-revealed',
          payload: { seatId: 'winner', hand: ['2♠', '3♠'] },
        },
      ]);
      expect(fixture.game.getState().playState?.revealedHands).toEqual({
        winner: ['2♠', '3♠'],
      });

      const completion = await fixture.broken.finalize(preparation.followUp!);

      expect(completion.success).toBe(true);
      expect(fixture.game.getState().playState?.revealedHands).toBeUndefined();
    } finally {
      await fixture.module.close();
    }
  });
});
