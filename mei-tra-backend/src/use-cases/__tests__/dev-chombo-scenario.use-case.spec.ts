import type { ChomboResolvedPayload } from '@contracts/game';
import type { IRoomService } from '../../services/interfaces/room-service.interface';
import type { ChomboViolation, DomainPlayer } from '../../types/game.types';
import { asSeatId } from '../../types/identity.types';
import { DevChomboScenarioUseCase } from '../dev-chombo-scenario.use-case';
import { createGame } from './chombo-game.fixture';

const seat = (seatId: string, team: 0 | 1): DomainPlayer => ({
  seatId: asSeatId(seatId),
  name: seatId,
  team,
  hand: [],
  isPasser: false,
});

async function setUpScenario(violationType: ChomboViolation['type']) {
  const fixture = await createGame(
    [],
    [seat('opponent', 1), seat('partner', 0), seat('rival', 1)],
  );
  fixture.game.getState().gamePhase = 'blow';
  const useCase = new DevChomboScenarioUseCase(
    fixture.roomService as unknown as IRoomService,
    fixture.cards,
  );
  const result = await useCase.execute({
    roomId: 'room-1',
    actorId: 'winner',
    violationType,
  });
  return { fixture, result };
}

async function isReportedCorrectly(
  fixture: Awaited<ReturnType<typeof createGame>>,
  violationType: ChomboViolation['type'],
): Promise<boolean | undefined> {
  const report = await fixture.report.execute({
    roomId: 'room-1',
    actorId: 'opponent',
    violatorSeatId: asSeatId('winner'),
    violationType,
  });
  const resolved = report.events?.find(
    (event) => event.event === 'chombo-resolved',
  );
  return (resolved?.payload as ChomboResolvedPayload | undefined)?.isCorrect;
}

const scenarioTypes: ChomboViolation['type'][] = [
  'negri-forget',
  'wrong-suit',
  'four-jack',
  'last-tanzen',
  'wrong-open',
];

describe('DevChomboScenarioUseCase', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it.each(scenarioTypes)(
    'places every card once and gives the requester the turn for %s',
    async (violationType) => {
      const { fixture, result } = await setUpScenario(violationType);
      try {
        expect(result.success).toBe(true);
        expect(result.events?.map((event) => event.event)).toEqual(
          expect.arrayContaining(['new-round-started', 'update-turn']),
        );

        const state = fixture.game.getState();
        const placedCards = [
          ...state.players.flatMap((player) => player.hand),
          ...(state.playState?.fields ?? []).flatMap((field) => field.cards),
          ...(state.playState?.currentField?.cards ?? []),
          ...(state.playState?.negriCard ? [state.playState.negriCard] : []),
        ];
        expect(placedCards.sort()).toEqual(fixture.cards.generateDeck().sort());
        expect(state.gamePhase).toBe('play');
        expect(state.currentSeatId).toBe('winner');
      } finally {
        await fixture.module.close();
      }
    },
  );

  it('lets the requester play without placing the negri', async () => {
    const { fixture } = await setUpScenario('negri-forget');
    try {
      const [card] = fixture.game.getState().players[0].hand;
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card,
      });
      expect(played.success).toBe(true);
      expect(await isReportedCorrectly(fixture, 'negri-forget')).toBe(true);
    } finally {
      await fixture.module.close();
    }
  });

  it('lets the requester play off suit', async () => {
    const { fixture } = await setUpScenario('wrong-suit');
    try {
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: '6♦',
      });
      expect(played.success).toBe(true);
      expect(await isReportedCorrectly(fixture, 'wrong-suit')).toBe(true);
    } finally {
      await fixture.module.close();
    }
  });

  it('lets the requester play on with four jacks', async () => {
    const { fixture } = await setUpScenario('four-jack');
    try {
      const [card] = fixture.game.getState().players[0].hand;
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card,
      });
      expect(played.success).toBe(true);
      expect(await isReportedCorrectly(fixture, 'four-jack')).toBe(true);
    } finally {
      await fixture.module.close();
    }
  });

  it('lets the requester keep the Joker as their last card', async () => {
    const { fixture } = await setUpScenario('last-tanzen');
    try {
      const [card] = fixture.game
        .getState()
        .players[0].hand.filter((handCard) => handCard !== 'JOKER');
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card,
      });
      expect(played.success).toBe(true);
      expect(await isReportedCorrectly(fixture, 'last-tanzen')).toBe(true);
    } finally {
      await fixture.module.close();
    }
  });

  it('lets the requester open a hand that cannot take every field', async () => {
    const { fixture } = await setUpScenario('wrong-open');
    try {
      const opened = await fixture.open.execute({
        roomId: 'room-1',
        actorId: 'winner',
      });
      expect(opened.success).toBe(true);
      expect(await isReportedCorrectly(fixture, 'wrong-open')).toBe(true);
    } finally {
      await fixture.module.close();
    }
  });

  it('refuses to rearrange a game in production', async () => {
    process.env.NODE_ENV = 'production';
    const { fixture, result } = await setUpScenario('four-jack');
    try {
      expect(result).toEqual({
        success: false,
        error: 'Chombo scenarios are only available in development',
      });
    } finally {
      await fixture.module.close();
    }
  });
});
