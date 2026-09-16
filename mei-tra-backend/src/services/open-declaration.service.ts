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

  canDeclareOpen(state: GameState, declarerSeatId: SeatId): boolean {
    if (state.gamePhase !== 'play' || !state.playState) return false;

    const declarer = state.players.find(
      (player) => player.seatId === declarerSeatId,
    );
    if (!declarer || declarer.isCOM) return false;

    const hands = new Map(
      state.players.map((player) => [player.seatId, [...player.hand]]),
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

    const solve = (turnSeatId: SeatId, nextField: Field): boolean => {
      searchedNodes += 1;
      if (searchedNodes > this.maxSearchNodes) return false;

      const key = this.key(turnSeatId, nextField, hands);
      const remembered = memo.get(key);
      if (remembered !== undefined) return remembered;

      const turnPlayer = state.players.find(
        (player) => player.seatId === turnSeatId,
      );
      if (!turnPlayer) return false;
      const hand = hands.get(turnSeatId) ?? [];
      if (hand.length === 0) {
        const result = this.allHandsEmpty(hands);
        memo.set(key, result);
        return result;
      }

      const legalCards = this.playService.getLegalPlayCards(
        hand,
        nextField.cards.length > 0 ? nextField : null,
        state.blowState.currentTrump,
      );
      const choices = legalCards.length > 0 ? legalCards : hand;
      const outcomes = choices.flatMap((card) => {
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
        const branchOutcomes = fields.map((branchField) =>
          branchField.isComplete
            ? this.resolveCompletedField(
                state,
                declarer.team,
                hands,
                branchField,
                solve,
              )
            : solve(this.nextSeat(state.players, turnSeatId), branchField),
        );
        hands.set(turnSeatId, hand);
        return branchOutcomes;
      });

      const result =
        turnPlayer.team === declarer.team
          ? outcomes.some(Boolean)
          : outcomes.every(Boolean);
      memo.set(key, result);
      return result;
    };

    return solve(state.currentSeatId ?? declarerSeatId, field);
  }

  private resolveCompletedField(
    state: GameState,
    declarerTeam: 0 | 1,
    hands: Map<SeatId, string[]>,
    field: Field,
    solve: (turnSeatId: SeatId, field: Field) => boolean,
  ): boolean {
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
      .map(([seatId, hand]) => `${seatId}:${[...hand].sort().join(',')}`)
      .sort()
      .join('|');
    return `${turnSeatId}|${field.cards.join(',')}|${field.playedBySeatIds.join(',')}|${field.baseSuit ?? ''}|${handKey}`;
  }
}
