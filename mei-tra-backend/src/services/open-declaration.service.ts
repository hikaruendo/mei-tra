import { Injectable } from '@nestjs/common';
import type { SeatId } from '../types/identity.types';
import type {
  DomainPlayer,
  Field,
  GameState,
  TrumpType,
} from '../types/game.types';
import { CardService } from './card.service';
import { PlayService } from './play.service';

const SUITED_TRUMPS: TrumpType[] = ['zuppe', 'club', 'daiya', 'herz'];

/**
 * Evaluates the open rule against the authoritative server state.
 * A valid open means the opener's team has a strategy that wins every
 * remaining trick, even when the opposing team chooses its cards adversarially.
 */
@Injectable()
export class OpenDeclarationService {
  private readonly maxSearchNodes = 100_000;

  constructor(
    private readonly playService: PlayService,
    private readonly cardService: CardService = new CardService(),
  ) {}

  canDeclareOpen(state: GameState, declarerSeatId: SeatId): boolean | null {
    if (state.gamePhase !== 'play' || !state.playState) return false;

    const declarer = state.players.find(
      (player) => player.seatId === declarerSeatId,
    );
    if (!declarer || declarer.isCOM || declarer.hand.length === 0) return false;
    if (
      state.currentSeatId !== declarerSeatId ||
      state.playState.currentField?.isComplete ||
      state.playState.currentField?.playedBySeatIds.includes(declarerSeatId)
    ) {
      return false;
    }

    const hands = new Map(
      state.players.map((player) => [player.seatId, [...player.hand].sort()]),
    );
    const currentField = state.playState.currentField;
    const field: Field = currentField
      ? {
          ...currentField,
          cards: [...currentField.cards],
          playedBySeatIds: [...currentField.playedBySeatIds],
        }
      : {
          cards: [],
          playedBySeatIds: [],
          baseCard: '',
          dealerSeatId: state.currentSeatId ?? declarerSeatId,
          isComplete: false,
        };
    const memo = new Map<string, boolean>();
    let searchedNodes = 0;
    const playersBySeat = new Map(
      state.players.map((player) => [player.seatId, player]),
    );

    const solve = (turnSeatId: SeatId, nextField: Field): boolean | null => {
      const key = this.key(turnSeatId, nextField, hands);
      const remembered = memo.get(key);
      if (remembered !== undefined) return remembered;

      const turnPlayer = playersBySeat.get(turnSeatId);
      if (!turnPlayer) return false;
      const hand = hands.get(turnSeatId) ?? [];
      if (hand.length === 0) {
        const result = this.allHandsEmpty(hands);
        memo.set(key, result);
        return result;
      }

      // At an empty field, this seat keeps the lead by cashing its remaining
      // trumps/masters. Compare against the partner too: an overtaking partner
      // could otherwise strand the lead in a losing hand.
      if (
        nextField.cards.length === 0 &&
        turnPlayer.team === declarer.team &&
        this.hasUnbeatableHand(turnSeatId, hands, state.blowState.currentTrump)
      ) {
        memo.set(key, true);
        return true;
      }
      searchedNodes += 1;
      // Exhaustion is not proof of a failed open (which costs five points).
      if (searchedNodes > this.maxSearchNodes) return null;

      const legalCards = this.playService.getLegalPlayCards(
        hand,
        nextField.cards.length > 0 ? nextField : null,
        state.blowState.currentTrump,
      );
      const choices = legalCards.length > 0 ? legalCards : hand;
      const friendlyTurn = turnPlayer.team === declarer.team;
      let uncertain = false;
      for (const card of choices) {
        hands.set(
          turnSeatId,
          hand.filter((candidate) => candidate !== card),
        );
        const playedField: Field = {
          ...nextField,
          cards: [...nextField.cards, card],
          playedBySeatIds: [...nextField.playedBySeatIds, turnSeatId],
          baseCard: nextField.cards.length === 0 ? card : nextField.baseCard,
          isComplete: nextField.cards.length + 1 === state.players.length,
        };
        // Leading the Joker hands the base suit choice to the leader, so the
        // suit is another branch owned by this seat and folded into the same
        // minimax rule below.
        const fields: Field[] =
          nextField.cards.length === 0 && card === 'JOKER'
            ? this.baseSuitChoices(
                hands,
                turnSeatId,
                state.blowState.currentTrump,
              ).map((baseSuit) => ({ ...playedField, baseSuit }))
            : [playedField];
        for (const branchField of fields) {
          const outcome = branchField.isComplete
            ? this.resolveCompletedField(
                state,
                declarer.team,
                hands,
                branchField,
                solve,
              )
            : solve(this.nextSeat(state.players, turnSeatId), branchField);
          if (outcome === null) uncertain = true;
          // One winning move suffices for our team; one losing reply suffices
          // for the opponents. Restore the simulated hand before returning.
          if (outcome === friendlyTurn) {
            hands.set(turnSeatId, hand);
            memo.set(key, outcome);
            return outcome;
          }
        }
        hands.set(turnSeatId, hand);
      }

      if (uncertain) return null;
      const result = !friendlyTurn;
      memo.set(key, result);
      return result;
    };

    return solve(state.currentSeatId ?? declarerSeatId, field);
  }

  private hasUnbeatableHand(
    leadSeatId: SeatId,
    hands: Map<SeatId, string[]>,
    trump: TrumpType | null,
  ): boolean {
    const hand = hands.get(leadSeatId)!;
    const otherHands = [...hands.entries()].filter(
      ([seatId]) => seatId !== leadSeatId,
    );
    if (otherHands.some(([, cards]) => cards.length !== hand.length)) {
      return false;
    }

    return hand.every((card) => {
      // The Joker wins with any chosen base suit; all other cards use the
      // canonical effective suit/strength (including the secondary Jack).
      if (card === 'JOKER') return true;
      const suit = this.cardService.getCardSuit(card, trump);
      const strength = this.cardService.getCardStrength(card, suit, trump);
      return otherHands.every(([, cards]) =>
        cards.every(
          (other) =>
            this.cardService.getCardStrength(other, suit, trump) < strength,
        ),
      );
    });
  }

  private resolveCompletedField(
    state: GameState,
    declarerTeam: 0 | 1,
    hands: Map<SeatId, string[]>,
    field: Field,
    solve: (turnSeatId: SeatId, field: Field) => boolean | null,
  ): boolean | null {
    const winner = this.playService.determineFieldWinner(
      field,
      state.players,
      state.blowState.currentTrump,
    );
    if (!winner) return false;
    if (winner.team !== declarerTeam) return false;
    if (this.allHandsEmpty(hands)) return true;

    return solve(winner.seatId, {
      cards: [],
      playedBySeatIds: [],
      baseCard: '',
      dealerSeatId: winner.seatId,
      isComplete: false,
    });
  }

  /**
   * Base suits the Joker leader can pick from. Suits nobody else can follow
   * all constrain the field identically, so a single one stands in for them.
   */
  private baseSuitChoices(
    hands: Map<SeatId, string[]>,
    leadSeatId: SeatId,
    trump: TrumpType | null,
  ): string[] {
    const suits = SUITED_TRUMPS.map((trumpType) =>
      this.cardService.getTrumpSuit(trumpType),
    );
    const followable = new Set<string>();
    for (const [seatId, hand] of hands) {
      if (seatId === leadSeatId) continue;
      for (const card of hand) {
        if (card === 'JOKER') continue;
        followable.add(this.cardService.getCardSuit(card, trump));
      }
    }

    const choices = suits.filter((suit) => followable.has(suit));
    const unfollowable = suits.find((suit) => !followable.has(suit));
    if (unfollowable !== undefined) {
      choices.push(unfollowable);
    }
    return choices;
  }

  private nextSeat(players: DomainPlayer[], seatId: SeatId): SeatId {
    const index = players.findIndex((player) => player.seatId === seatId);
    return players[(index + 1) % players.length].seatId;
  }

  private allHandsEmpty(hands: Map<SeatId, string[]>): boolean {
    return [...hands.values()].every((hand) => hand.length === 0);
  }

  private key(
    turnSeatId: SeatId,
    field: Field,
    hands: Map<SeatId, string[]>,
  ): string {
    const handKey = [...hands.entries()]
      .map(([seatId, hand]) => `${seatId}:${hand.join(',')}`)
      .join('|');
    return `${turnSeatId}|${field.cards.join(',')}|${field.playedBySeatIds.join(',')}|${field.baseSuit ?? ''}|${handKey}`;
  }
}
