import { asSeatId } from '../../types/identity.types';
import { createGame } from './chombo-game.fixture';

describe('Pro card play and chombo reporting', () => {
  it('does not create a chombo candidate for a COM player', async () => {
    const fixture = await createGame(['A♠', 'K♠']);
    try {
      fixture.game.getState().players[0].isCOM = true;
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: 'A♠',
      });
      expect(played.success).toBe(true);
      const result = await fixture.report.execute({
        roomId: 'room-1',
        actorId: 'opponent',
        violatorSeatId: asSeatId('winner'),
        violationType: 'negri-forget',
      });
      expect(result.events).toContainEqual(
        expect.objectContaining({
          event: 'chombo-resolved',
          payload: expect.objectContaining({
            isCorrect: false,
            awardedTeam: 0,
          }),
        }),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('still awards a Negri-forget report after the winner skips Negri', async () => {
    const fixture = await createGame(['A♠', 'K♠']);
    try {
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: 'A♠',
      });
      expect(played.success).toBe(true);
      const result = await fixture.report.execute({
        roomId: 'room-1',
        actorId: 'opponent',
        violatorSeatId: asSeatId('winner'),
        violationType: 'negri-forget',
      });
      expect(result.success).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          event: 'chombo-resolved',
          payload: expect.objectContaining({
            isCorrect: true,
            awardedTeam: 1,
            scores: { 0: { play: 0, total: 0 }, 1: { play: 5, total: 5 } },
          }),
        }),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('records a four-jack candidate before a report', async () => {
    const fixture = await createGame(['J♠', 'J♥', 'J♦', 'J♣']);
    try {
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: 'J♠',
      });
      expect(played.success).toBe(true);
      const result = await fixture.report.execute({
        roomId: 'room-1',
        actorId: 'opponent',
        violatorSeatId: asSeatId('winner'),
        violationType: 'four-jack',
      });
      expect(result.success).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          event: 'chombo-resolved',
          payload: expect.objectContaining({ isCorrect: true, awardedTeam: 1 }),
        }),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('awards a last-Tanzen report after the last Joker leaves the hand', async () => {
    const fixture = await createGame(['JOKER']);
    try {
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: 'JOKER',
      });
      expect(played.success).toBe(true);
      const result = await fixture.report.execute({
        roomId: 'room-1',
        actorId: 'opponent',
        violatorSeatId: asSeatId('winner'),
        violationType: 'last-tanzen',
      });
      expect(result.success).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          event: 'chombo-resolved',
          payload: expect.objectContaining({ isCorrect: true, awardedTeam: 1 }),
        }),
      );
    } finally {
      await fixture.module.close();
    }
  });
});
