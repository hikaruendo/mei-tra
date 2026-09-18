import { asSeatId } from '../../types/identity.types';
import { createGame } from './chombo-game.fixture';
import type { GatewayEvent } from '../interfaces/gateway-event.interface';
import type { ChomboViolation } from '../../types/game.types';

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

describe('How long a completed pro field stays on the table', () => {
  const lastTanzenBy = (seatId: string): ChomboViolation => ({
    type: 'last-tanzen',
    violatorSeatId: asSeatId(seatId),
    timestamp: 1,
    reportedBySeatId: null,
    isExpired: false,
  });

  // The other three seats have already played into the field, so the winner's
  // card fills it.
  const fillField = async ({
    winnerHand,
    card,
    candidates = [],
    opponentsAreCOM = false,
    gameMode = 'pro',
  }: {
    winnerHand: string[];
    card: string;
    candidates?: ChomboViolation[];
    opponentsAreCOM?: boolean;
    gameMode?: 'pro' | 'normal';
  }) => {
    const fixture = await createGame(winnerHand, [
      {
        seatId: asSeatId('opponent'),
        name: 'Opponent',
        team: 1,
        hand: [],
        isPasser: false,
        isCOM: opponentsAreCOM,
      },
      {
        seatId: asSeatId('partner'),
        name: 'Partner',
        team: 0,
        hand: [],
        isPasser: false,
      },
      {
        seatId: asSeatId('second-opponent'),
        name: 'Second opponent',
        team: 1,
        hand: [],
        isPasser: false,
        isCOM: opponentsAreCOM,
      },
    ]);
    fixture.room.settings.gameMode = gameMode;
    const playState = fixture.game.getState().playState!;
    playState.chomboViolations = candidates;
    playState.currentField = {
      cards: ['7♠', '8♠', '9♠'],
      playedBySeatIds: [
        asSeatId('opponent'),
        asSeatId('partner'),
        asSeatId('second-opponent'),
      ],
      baseCard: '7♠',
      dealerSeatId: asSeatId('opponent'),
      isComplete: false,
    };
    try {
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card,
      });
      expect(played.success).toBe(true);
      return played.completeFieldTrigger?.delayMs;
    } finally {
      await fixture.module.close();
    }
  };

  it('holds the last field for 10 seconds when its Joker is a last tanzen', async () => {
    await expect(
      fillField({
        winnerHand: ['JOKER'],
        card: 'JOKER',
        candidates: [lastTanzenBy('winner')],
      }),
    ).resolves.toBe(10_000);
  });

  it('collects the last field after 3 seconds without a last tanzen', async () => {
    await expect(fillField({ winnerHand: ['5♠'], card: '5♠' })).resolves.toBe(
      3000,
    );
  });

  it('does not hold the field while the violator still holds the Joker', async () => {
    // The winner's second-to-last card fills this field, which is what records
    // the last tanzen; the Joker is still in hand for the next field.
    await expect(
      fillField({ winnerHand: ['5♠', 'JOKER'], card: '5♠' }),
    ).resolves.toBe(3000);
  });

  it('does not hold the field when only COM seats could report', async () => {
    await expect(
      fillField({
        winnerHand: ['JOKER'],
        card: 'JOKER',
        candidates: [lastTanzenBy('winner')],
        opponentsAreCOM: true,
      }),
    ).resolves.toBe(3000);
  });

  it('keeps the 3 second pause outside pro mode', async () => {
    await expect(
      fillField({
        winnerHand: ['5♠'],
        card: '5♠',
        candidates: [lastTanzenBy('winner')],
        gameMode: 'normal',
      }),
    ).resolves.toBe(3000);
  });
});
