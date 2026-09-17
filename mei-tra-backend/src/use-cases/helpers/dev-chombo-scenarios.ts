import type { DevChomboScenarioType } from '@contracts/game';
import type { CompletedField, Field, TrumpType } from '../../types/game.types';
import type { SeatId } from '../../types/identity.types';

export type { DevChomboScenarioType };

export interface DevChomboScenarioSeat {
  seatId: SeatId;
  team: CompletedField['winnerTeam'];
}

export interface DevChomboScenario {
  trump: TrumpType;
  declarerSeatId: SeatId;
  hands: Record<string, string[]>;
  negriCard: string | null;
  agari: string | null;
  currentField: Field | null;
  fields: CompletedField[];
  lastWinnerSeatId: SeatId | null;
  currentSeatId: SeatId;
}

const SCENARIO_TRUMP: TrumpType = 'herz';

function createCardPool(deck: string[]) {
  const cards = [...deck];
  return {
    take(...wanted: string[]): string[] {
      for (const card of wanted) {
        const index = cards.indexOf(card);
        if (index === -1) {
          throw new Error(`Card ${card} is not in the deck`);
        }
        cards.splice(index, 1);
      }
      return wanted;
    },
    draw(count: number): string[] {
      if (count > cards.length) {
        throw new Error('The deck ran out of cards');
      }
      return cards.splice(0, count);
    },
    assertEmpty(): void {
      if (cards.length > 0) {
        throw new Error(`${cards.length} cards were left undealt`);
      }
    },
  };
}

type CardPool = ReturnType<typeof createCardPool>;

const emptyField = (dealerSeatId: SeatId): Field => ({
  cards: [],
  playedBySeatIds: [],
  baseCard: '',
  dealerSeatId,
  isComplete: false,
});

function dealHands(
  pool: CardPool,
  seats: DevChomboScenarioSeat[],
  countFor: (seat: DevChomboScenarioSeat) => number,
): Record<string, string[]> {
  return Object.fromEntries(
    seats.map((seat) => [seat.seatId, pool.draw(countFor(seat))]),
  );
}

// The requester leads the first field as declarer and wins the last one, so
// they lead the field that is still to be played.
function playFinishedFields(
  pool: CardPool,
  seats: DevChomboScenarioSeat[],
  requesterIndex: number,
  count: number,
): CompletedField[] {
  const fields: CompletedField[] = [];
  let dealer = seats[requesterIndex];
  for (let index = 0; index < count; index += 1) {
    const winner =
      index === count - 1
        ? seats[requesterIndex]
        : seats[(requesterIndex + index + 1) % seats.length];
    fields.push({
      cards: pool.draw(seats.length),
      winnerSeatId: winner.seatId,
      winnerTeam: winner.team,
      dealerSeatId: dealer.seatId,
    });
    dealer = winner;
  }
  return fields;
}

/**
 * Development only. Lays out a play-phase table where the requester commits
 * the given chombo with their next action. Every card of the deck is placed
 * exactly once, in a hand, a finished field, the current field or the negri.
 */
export function buildDevChomboScenario({
  seats,
  requesterSeatId,
  type,
  deck,
}: {
  seats: DevChomboScenarioSeat[];
  requesterSeatId: SeatId;
  type: DevChomboScenarioType;
  deck: string[];
}): DevChomboScenario {
  const requesterIndex = seats.findIndex(
    (seat) => seat.seatId === requesterSeatId,
  );
  if (requesterIndex === -1) {
    throw new Error('The requester has no seat at the table');
  }

  const pool = createCardPool(deck);
  const requester = seats[requesterIndex];
  const isRequester = (seat: DevChomboScenarioSeat) =>
    seat.seatId === requester.seatId;
  const base = {
    trump: SCENARIO_TRUMP,
    declarerSeatId: requester.seatId,
    agari: null,
    currentField: emptyField(requester.seatId),
    fields: [],
    lastWinnerSeatId: null,
    currentSeatId: requester.seatId,
  };

  let scenario: DevChomboScenario;
  switch (type) {
    case 'negri-forget': {
      const hands = dealHands(pool, seats, (seat) =>
        isRequester(seat) ? 11 : 10,
      );
      scenario = {
        ...base,
        hands,
        negriCard: null,
        agari: hands[requester.seatId][10],
        currentField: null,
      };
      break;
    }
    case 'wrong-suit': {
      const dealer = seats[(requesterIndex + seats.length - 1) % seats.length];
      const [leadCard] = pool.take('9♠');
      const suitCards = pool.take('5♠', '6♦');
      const [negriCard] = pool.draw(1);
      const hands = dealHands(pool, seats, (seat) =>
        seat.seatId === dealer.seatId ? 9 : isRequester(seat) ? 8 : 10,
      );
      hands[requester.seatId].push(...suitCards);
      scenario = {
        ...base,
        declarerSeatId: dealer.seatId,
        hands,
        negriCard,
        currentField: {
          cards: [leadCard],
          playedBySeatIds: [dealer.seatId],
          baseCard: leadCard,
          dealerSeatId: dealer.seatId,
          isComplete: false,
        },
      };
      break;
    }
    case 'four-jack': {
      const jacks = pool.take('J♠', 'J♣', 'J♥', 'J♦');
      const [negriCard] = pool.draw(1);
      const hands = dealHands(pool, seats, (seat) =>
        isRequester(seat) ? 6 : 10,
      );
      hands[requester.seatId].push(...jacks);
      scenario = { ...base, hands, negriCard };
      break;
    }
    case 'last-tanzen': {
      // Two cards left with the Joker still in hand. Playing the other card
      // leaves only the Joker, which is the violation.
      const joker = pool.take('JOKER');
      const [negriCard] = pool.draw(1);
      const fields = playFinishedFields(pool, seats, requesterIndex, 8);
      const hands = dealHands(pool, seats, (seat) =>
        isRequester(seat) ? 1 : 2,
      );
      hands[requester.seatId].push(...joker);
      scenario = {
        ...base,
        hands,
        negriCard,
        fields,
        lastWinnerSeatId: requester.seatId,
      };
      break;
    }
    case 'failed-open': {
      // The other team holds every jack, the Joker and the top trumps, so the
      // requester's team cannot take all of the remaining fields.
      const partner = seats.find(
        (seat) => seat.team === requester.team && !isRequester(seat),
      );
      const [rival, secondRival] = seats.filter(
        (seat) => seat.team !== requester.team,
      );
      if (!partner || !rival || !secondRival) {
        throw new Error('A failed open needs two players on each team');
      }
      const hands: Record<string, string[]> = {
        [requester.seatId]: pool.take('5♣', '6♣', '5♦', '6♦'),
        [partner.seatId]: pool.take('7♣', '8♣', '7♦', '8♦'),
        [rival.seatId]: pool.take('JOKER', 'J♥', 'J♦', 'A♥'),
        [secondRival.seatId]: pool.take('J♠', 'J♣', 'K♥', 'Q♥'),
      };
      const [negriCard] = pool.draw(1);
      const fields = playFinishedFields(pool, seats, requesterIndex, 6);
      scenario = {
        ...base,
        hands,
        negriCard,
        fields,
        lastWinnerSeatId: requester.seatId,
      };
      break;
    }
    default: {
      const unknownType: never = type;
      throw new Error(`Unknown chombo scenario: ${String(unknownType)}`);
    }
  }

  pool.assertEmpty();
  return scenario;
}
