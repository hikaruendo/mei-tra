import { asSeatId } from '../../types/identity.types';
import { createGame } from './chombo-game.fixture';
import type { GatewayEvent } from '../interfaces/gateway-event.interface';

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
        expect.objectContaining<Partial<GatewayEvent>>({
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
        expect.objectContaining<Partial<GatewayEvent>>({
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
        expect.objectContaining<Partial<GatewayEvent>>({
          event: 'chombo-resolved',
          payload: expect.objectContaining({ isCorrect: true, awardedTeam: 1 }),
        }),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('awards a last-tanzen report once the Joker is the only card left', async () => {
    const fixture = await createGame(['5♠', 'JOKER']);
    try {
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: '5♠',
      });
      expect(played.success).toBe(true);
      const candidateTypes = (
        fixture.game.getState().playState?.chomboViolations ?? []
      ).map((violation) => violation.type);
      expect(candidateTypes).toContain('last-tanzen');
      expect(candidateTypes).not.toContain('wrong-suit');

      const result = await fixture.report.execute({
        roomId: 'room-1',
        actorId: 'opponent',
        violatorSeatId: asSeatId('winner'),
        violationType: 'last-tanzen',
      });
      const resolved = result.events?.find(
        (event) => event.event === 'chombo-resolved',
      );
      expect(resolved?.payload).toEqual(
        expect.objectContaining({ isCorrect: true, awardedTeam: 1 }),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('does not count a Joker played by the second-to-last card as a last-tanzen', async () => {
    const fixture = await createGame(['5♠', 'JOKER']);
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
      const resolved = result.events?.find(
        (event) => event.event === 'chombo-resolved',
      );
      expect(resolved?.payload).toEqual(
        expect.objectContaining({ isCorrect: false, awardedTeam: 0 }),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('awards a last-tanzen report when the Negri leaves only the Joker', async () => {
    const fixture = await createGame(['5♠', 'JOKER']);
    try {
      // Placing a Negri syncs the room, which needs the room's own details.
      Object.assign(fixture.room, {
        id: 'room-1',
        players: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      });
      const state = fixture.game.getState();
      state.blowState.declarations = [
        state.blowState.currentHighestDeclaration!,
      ];
      const placed = await fixture.negri.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: '5♠',
      });
      expect(placed.success).toBe(true);

      const result = await fixture.report.execute({
        roomId: 'room-1',
        actorId: 'opponent',
        violatorSeatId: asSeatId('winner'),
        violationType: 'last-tanzen',
      });
      const resolved = result.events?.find(
        (event) => event.event === 'chombo-resolved',
      );
      expect(resolved?.payload).toEqual(
        expect.objectContaining({ isCorrect: true, awardedTeam: 1 }),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('records a wrong-suit candidate from an illegal card play', async () => {
    const fixture = await createGame(['A♥', 'A♠']);
    try {
      fixture.game.getState().playState!.currentField = {
        cards: ['A♠'],
        playedBySeatIds: [asSeatId('opponent')],
        baseCard: 'A♠',
        dealerSeatId: asSeatId('winner'),
        isComplete: false,
      };
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: 'A♥',
      });
      expect(played.success).toBe(true);
      const report = await fixture.report.execute({
        roomId: 'room-1',
        actorId: 'opponent',
        violatorSeatId: asSeatId('winner'),
        violationType: 'wrong-suit',
      });
      expect(report.events).toContainEqual(
        expect.objectContaining<Partial<GatewayEvent>>({
          event: 'chombo-resolved',
          payload: expect.objectContaining({ isCorrect: true }),
        }),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('rejects a pro mode broken reveal without a broken or four-jack hand', async () => {
    const fixture = await createGame(['2♠']);
    try {
      fixture.game.getState().gamePhase = 'blow';
      const reveal = await fixture.broken.prepare({
        roomId: 'room-1',
        actorId: 'winner',
        seatId: asSeatId('winner'),
      });
      expect(reveal).toEqual({
        success: false,
        error: 'Player does not have broken hand',
      });
      const { pendingBrokenHandReveal, playState } = fixture.game.getState();
      expect(pendingBrokenHandReveal).toBeFalsy();
      expect(playState?.chomboViolations ?? []).toEqual([]);
    } finally {
      await fixture.module.close();
    }
  });

  it('records a wrong-open candidate through its action', async () => {
    const fixture = await createGame(['2♠']);
    try {
      fixture.game.getState().players[1].hand = ['A♠'];
      fixture.game.getState().playState!.openDeclared = false;
      const open = await fixture.open.execute({
        roomId: 'room-1',
        actorId: 'winner',
      });
      expect(open.success).toBe(true);
      expect(fixture.game.getState().playState?.chomboViolations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'wrong-open' }),
        ]),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('drops a played card from a revealed hand', async () => {
    const fixture = await createGame(['A♠', 'K♠']);
    try {
      fixture.game.getState().playState!.revealedHands = {
        winner: ['A♠', 'K♠'],
      };
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: 'A♠',
      });
      expect(played.success).toBe(true);
      expect(fixture.game.getState().playState?.revealedHands).toEqual({
        winner: ['K♠'],
      });
    } finally {
      await fixture.module.close();
    }
  });
});
