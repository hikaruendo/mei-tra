import type { RoomSyncPayload } from '@contracts/room';
import type { ChomboResolvedPayload } from '@contracts/game';
import { ScoreService } from '../../services/score.service';
import type {
  CompletedField,
  DomainPlayer,
  Team,
} from '../../types/game.types';
import { asSeatId } from '../../types/identity.types';
import type { CompleteFieldTrigger } from '../interfaces/play-card.use-case.interface';
import { createGame } from './chombo-game.fixture';

const winner = asSeatId('winner');
const scoreService = new ScoreService();

const seat = (seatId: string, team: Team, hand: string[]): DomainPlayer => ({
  seatId: asSeatId(seatId),
  name: seatId,
  team,
  hand,
  isPasser: false,
});

const fieldWonByWinner = (): CompletedField => ({
  cards: [],
  winnerSeatId: winner,
  winnerTeam: 0,
  dealerSeatId: winner,
});

// Seats run winner (declared 7 pairs, team 0) -> left -> partner -> right.
// The winner took the agari and never placed the Negri, so after nine fields
// they hold two cards while everyone else holds one. The right seat's 9♠
// takes the last field.
async function playLastFieldWithoutNegri() {
  const fixture = await createGame(
    ['5♠', '6♠'],
    [
      seat('left', 1, ['7♠']),
      seat('partner', 0, ['8♠']),
      seat('right', 1, ['9♠']),
    ],
  );
  // Completing a field syncs the room, which needs the room's own details.
  Object.assign(fixture.room, {
    id: 'room-1',
    players: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
  });
  const state = fixture.game.getState();
  state.playState!.fields = Array.from({ length: 9 }, fieldWonByWinner);
  state.playState!.currentField = {
    cards: [],
    playedBySeatIds: [],
    baseCard: '',
    dealerSeatId: winner,
    isComplete: false,
  };
  // Recorded when the round's first card was played without a Negri.
  state.playState!.chomboRoundNumber = state.roundNumber;
  state.playState!.chomboViolations = [
    fixture.chombo.recordViolation(winner, 'negri-forget'),
  ];

  let trigger: CompleteFieldTrigger | undefined;
  for (const [actorId, card] of [
    ['winner', '5♠'],
    ['left', '7♠'],
    ['partner', '8♠'],
    ['right', '9♠'],
  ]) {
    const played = await fixture.play.execute({
      roomId: 'room-1',
      actorId,
      card,
    });
    expect(played.success).toBe(true);
    trigger = played.completeFieldTrigger ?? trigger;
  }
  if (!trigger) {
    throw new Error('The last card did not complete the field');
  }
  return { fixture, trigger };
}

function completeLastField(
  fixture: Awaited<ReturnType<typeof createGame>>,
  trigger: CompleteFieldTrigger,
) {
  return fixture.completeField.execute({
    roomId: 'room-1',
    field: trigger.field,
    fieldIdentity: trigger.fieldIdentity,
  });
}

function reportForgottenNegri(fixture: Awaited<ReturnType<typeof createGame>>) {
  return fixture.report.execute({
    roomId: 'room-1',
    actorId: 'left',
    violatorSeatId: winner,
    violationType: 'negri-forget',
  });
}

describe('Pro round end with a Negri the winner never placed', () => {
  it('ends the round when the last field leaves only the unplaced Negri', async () => {
    const { fixture, trigger } = await playLastFieldWithoutNegri();
    try {
      const result = await completeLastField(fixture, trigger);

      expect(result.success).toBe(true);
      expect(result.events?.map((event) => event.event)).toEqual([
        'field-complete',
        'room-sync',
        'round-results',
      ]);
      const roomSync = result.events?.find(
        (event) => event.event === 'room-sync',
      )?.payload as RoomSyncPayload;
      expect(
        roomSync.players.find((player) => player.seatId === winner)?.hand,
      ).toEqual([]);
      expect(result.delayedEvents?.map((event) => event.event)).toContain(
        'new-round-started',
      );

      const state = fixture.game.getState();
      expect(state.gamePhase).toBe('blow');
      expect(state.roundNumber).toBe(2);
      // Nine of the ten fields went to the declaring team.
      expect(state.teamScores[0].play).toBe(
        scoreService.calculatePlayPoints(7, 9),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('sets the last card aside as the Negri when the round ends the game', async () => {
    const { fixture, trigger } = await playLastFieldWithoutNegri();
    try {
      fixture.game.getState().pointsToWin = scoreService.calculatePlayPoints(
        7,
        9,
      );

      const result = await completeLastField(fixture, trigger);

      expect(result.events?.map((event) => event.event)).toContain('game-over');
      const state = fixture.game.getState();
      expect(state.playState?.negriCard).toBe('6♠');
      expect(state.playState?.negriSeatId).toBe(winner);
      expect(state.players.every((player) => player.hand.length === 0)).toBe(
        true,
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('still takes a Negri-forget report while the last field waits to clear', async () => {
    const { fixture } = await playLastFieldWithoutNegri();
    try {
      const result = await reportForgottenNegri(fixture);

      const resolved = result.events?.find(
        (event) => event.event === 'chombo-resolved',
      )?.payload as ChomboResolvedPayload;
      expect(resolved).toEqual(
        expect.objectContaining({ isCorrect: true, awardedTeam: 1 }),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('stops taking the Negri-forget report once the round has ended', async () => {
    const { fixture, trigger } = await playLastFieldWithoutNegri();
    try {
      await completeLastField(fixture, trigger);

      const result = await reportForgottenNegri(fixture);

      expect(result).toEqual({
        success: false,
        error: 'Chombo reports are only available during play',
      });
    } finally {
      await fixture.module.close();
    }
  });
});
