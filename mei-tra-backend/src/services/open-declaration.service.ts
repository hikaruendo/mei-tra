import { Injectable } from '@nestjs/common';
import type { SeatId } from '../types/identity.types';
import type { DomainPlayer, Field, GameState } from '../types/game.types';
import { PlayService } from './play.service';

/**
 * Evaluates the open rule against the authoritative server state.
 * A valid open means the opener's team has a strategy that wins every
 * remaining trick, even when the opposing team chooses its cards adversarially.
 */
@Injectable()
export class OpenDeclarationService {
  private readonly maxSearchNodes = 100_000;

  constructor(private readonly playService: PlayService) {}

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
      const outcomes = choices.map((card) => {
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
        const outcome = playedField.isComplete
          ? this.resolveCompletedField(
              state,
              declarer.team,
              hands,
              playedField,
              solve,
            )
          : solve(this.nextSeat(state.players, turnSeatId), playedField);
        hands.set(turnSeatId, hand);
        return outcome;
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
