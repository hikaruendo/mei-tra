import { Inject, Injectable } from '@nestjs/common';
import {
  BlowDeclaration,
  DomainPlayer,
  Field,
  GameState,
  Team,
  TrumpType,
} from '../types/game.types';
import { IBlowService } from './interfaces/blow-service.interface';
import { ICardService } from './interfaces/card-service.interface';
import { IPlayService } from './interfaces/play-service.interface';
import {
  ComBlowAction,
  IComStrategyService,
} from './interfaces/com-strategy-service.interface';

type TrumpEvaluation = {
  trumpType: TrumpType;
  estimatedPairs: number;
  score: number;
};

const TRUMP_TYPES: TrumpType[] = ['zuppe', 'club', 'daiya', 'herz', 'tra'];
const TRUMP_STRENGTH: Record<TrumpType, number> = {
  zuppe: 1,
  club: 2,
  daiya: 3,
  herz: 4,
  tra: 5,
};
const TRUMP_TO_SUIT: Record<TrumpType, string> = {
  zuppe: '♠',
  club: '♣',
  daiya: '♦',
  herz: '♥',
  tra: '',
};
const SUITS = ['♠', '♥', '♦', '♣'];
const NON_DECLARABLE_PAIRS = 5;
const MIN_DECLARATION_SCORE = 3.8;
const SCORE_PER_ESTIMATED_PAIR = 1.35;
const ESTIMATED_PAIR_BASELINE = 5;
const MAX_ESTIMATED_PAIRS = 10;

@Injectable()
export class ComStrategyService implements IComStrategyService {
  constructor(
    @Inject('ICardService')
    private readonly cardService: ICardService,
    @Inject('IPlayService')
    private readonly playService: IPlayService,
    @Inject('IBlowService')
    private readonly blowService: IBlowService,
  ) {}

  chooseBlowAction(state: GameState, comPlayer: DomainPlayer): ComBlowAction {
    if (comPlayer.hasBroken || comPlayer.hasRequiredBroken) {
      return { type: 'pass' };
    }

    const currentHighest = state.blowState.currentHighestDeclaration;
    const currentHighestPlayer = currentHighest
      ? this.findPlayer(state, currentHighest.playerId)
      : null;
    const currentHighestIsPartner =
      currentHighestPlayer?.team === comPlayer.team;
    const evaluations = TRUMP_TYPES.map((trumpType) =>
      this.evaluateHandForTrump(comPlayer.hand, trumpType),
    ).sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return TRUMP_STRENGTH[b.trumpType] - TRUMP_STRENGTH[a.trumpType];
    });

    if (evaluations.length === 0 || evaluations[0].estimatedPairs < 6) {
      return { type: 'pass' };
    }

    if (currentHighestIsPartner) {
      const best = evaluations[0];
      const shouldOvercallPartner =
        currentHighest != null &&
        best.estimatedPairs >= currentHighest.numberOfPairs + 2 &&
        best.score >=
          this.scoreNeededForPairs(currentHighest.numberOfPairs + 2);

      if (!shouldOvercallPartner) {
        return { type: 'pass' };
      }
    }

    const declaration = this.findLowestValidDeclaration(
      evaluations,
      currentHighest,
      currentHighestIsPartner,
    );

    return declaration ? { type: 'declare', declaration } : { type: 'pass' };
  }

  chooseNegriCard(state: GameState, comPlayer: DomainPlayer): string {
    const trump =
      state.blowState.currentTrump ??
      state.blowState.currentHighestDeclaration?.trumpType ??
      null;

    return this.minBy(comPlayer.hand, (card) =>
      this.discardValue(card, trump, comPlayer.hand),
    );
  }

  choosePlayCard(state: GameState, comPlayer: DomainPlayer): string {
    const field = state.playState?.currentField ?? null;
    const trump = state.blowState.currentTrump;
    const legalCards = this.playService.getLegalPlayCards(
      comPlayer.hand,
      field,
      trump,
    );

    if (legalCards.length === 0) {
      throw new Error('COM player has no legal cards to play');
    }

    if (!field || field.cards.length === 0) {
      return this.chooseLeadCard(state, comPlayer, legalCards, trump);
    }

    const currentWinner = this.playService.determineFieldWinner(
      field,
      state.players,
      trump,
    );
    if (!currentWinner) {
      return this.chooseLeadCard(state, comPlayer, legalCards, trump);
    }

    const baseSuit = this.resolveFieldBaseSuit(field, trump);
    const currentWinningStrength = this.getCurrentWinningStrength(
      field,
      baseSuit,
      trump,
    );
    const cardsThatWin = legalCards
      .filter(
        (card) =>
          this.cardService.getCardStrength(card, baseSuit, trump) >
          currentWinningStrength,
      )
      .sort(
        (a, b) =>
          this.cardService.getCardStrength(a, baseSuit, trump) -
          this.cardService.getCardStrength(b, baseSuit, trump),
      );

    if (currentWinner.team === comPlayer.team) {
      const safeCards = legalCards.filter(
        (card) =>
          this.cardService.getCardStrength(card, baseSuit, trump) <=
          currentWinningStrength,
      );
      return this.chooseLowestDiscard(
        safeCards.length > 0 ? safeCards : legalCards,
        trump,
      );
    }

    if (cardsThatWin.length > 0) {
      return cardsThatWin[0];
    }

    return this.chooseLowestDiscard(legalCards, trump);
  }

  chooseBaseSuit(state: GameState, comPlayer: DomainPlayer): string {
    const trump = state.blowState.currentTrump;
    const preferredTrumpSuit = trump ? TRUMP_TO_SUIT[trump] : '';
    const rankedSuits = SUITS.map((suit) => ({
      suit,
      score: this.baseSuitControlScore(comPlayer.hand, suit, trump),
    })).sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.suit === preferredTrumpSuit) {
        return -1;
      }
      if (b.suit === preferredTrumpSuit) {
        return 1;
      }
      return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    });

    return rankedSuits[0]?.suit ?? '♠';
  }

  private chooseLeadCard(
    state: GameState,
    comPlayer: DomainPlayer,
    legalCards: string[],
    trump: TrumpType | null,
  ): string {
    const declaringTeam = this.findDeclaringTeam(state);
    const teamTaken = this.countCompletedFieldsByTeam(state, comPlayer.team);
    const declaration = state.blowState.currentHighestDeclaration;
    const remainingTricks = comPlayer.hand.length;
    const needsWins =
      declaringTeam === comPlayer.team &&
      declaration != null &&
      declaration.numberOfPairs - teamTaken >= remainingTricks - 1;

    if (needsWins || remainingTricks <= 3) {
      return this.chooseStrongestControlCard(legalCards, trump);
    }

    if (declaringTeam === comPlayer.team) {
      const nonJoker = legalCards.filter((card) => card !== 'JOKER');
      return this.chooseMiddleControlCard(
        nonJoker.length > 0 ? nonJoker : legalCards,
        trump,
      );
    }

    const nonControlCards = legalCards.filter(
      (card) => !this.isControlCard(card, trump),
    );
    return this.chooseLowestDiscard(
      nonControlCards.length > 0 ? nonControlCards : legalCards,
      trump,
    );
  }

  private findLowestValidDeclaration(
    evaluations: TrumpEvaluation[],
    currentHighest: BlowDeclaration | null,
    currentHighestIsPartner: boolean,
  ): { trumpType: TrumpType; numberOfPairs: number } | null {
    const candidates: Array<{
      trumpType: TrumpType;
      numberOfPairs: number;
      risk: number;
      trumpStrength: number;
    }> = [];

    for (const evaluation of evaluations) {
      for (let pairs = 6; pairs <= evaluation.estimatedPairs; pairs++) {
        const declaration = {
          trumpType: evaluation.trumpType,
          numberOfPairs: pairs,
        };
        if (!this.blowService.isValidDeclaration(declaration, currentHighest)) {
          continue;
        }

        if (
          currentHighestIsPartner &&
          currentHighest != null &&
          pairs < currentHighest.numberOfPairs + 2
        ) {
          continue;
        }

        candidates.push({
          ...declaration,
          risk: pairs - evaluation.estimatedPairs,
          trumpStrength: TRUMP_STRENGTH[evaluation.trumpType],
        });
      }
    }

    candidates.sort((a, b) => {
      if (a.numberOfPairs !== b.numberOfPairs) {
        return a.numberOfPairs - b.numberOfPairs;
      }
      if (a.risk !== b.risk) {
        return a.risk - b.risk;
      }
      return a.trumpStrength - b.trumpStrength;
    });

    const best = candidates[0];
    return best
      ? { trumpType: best.trumpType, numberOfPairs: best.numberOfPairs }
      : null;
  }

  private evaluateHandForTrump(
    hand: string[],
    trumpType: TrumpType,
  ): TrumpEvaluation {
    const trumpSuit = TRUMP_TO_SUIT[trumpType];
    const suitCounts = this.countSuits(hand, trumpType);
    let score = 0;

    for (const card of hand) {
      if (card === 'JOKER') {
        score += 2.2;
        continue;
      }

      const rank = this.getRank(card);
      const suit = this.cardService.getCardSuit(card, trumpType);
      const isTrump = trumpSuit !== '' && suit === trumpSuit;

      if (this.isPrimaryJack(card, trumpType)) {
        score += 1.5;
        continue;
      }

      if (this.isSecondaryJack(card, trumpType)) {
        score += 1.2;
        continue;
      }

      if (isTrump) {
        score += this.trumpCardValue(rank);
      } else {
        score += this.offTrumpCardValue(rank);
      }
    }

    const trumpCount = trumpSuit ? (suitCounts.get(trumpSuit) ?? 0) : 0;
    score += Math.max(0, trumpCount - 2) * 0.25;

    if (trumpSuit) {
      for (const suit of SUITS) {
        if (suit === trumpSuit) {
          continue;
        }
        const count = suitCounts.get(suit) ?? 0;
        if (count === 0) {
          score += 0.35;
        } else if (count === 1) {
          score += 0.2;
        }
      }
    }

    const estimatedPairs =
      score < MIN_DECLARATION_SCORE
        ? NON_DECLARABLE_PAIRS
        : Math.min(
            MAX_ESTIMATED_PAIRS,
            Math.max(
              6,
              Math.floor(
                ESTIMATED_PAIR_BASELINE + score / SCORE_PER_ESTIMATED_PAIR,
              ),
            ),
          );

    return { trumpType, estimatedPairs, score };
  }

  private scoreNeededForPairs(numberOfPairs: number): number {
    return (numberOfPairs - ESTIMATED_PAIR_BASELINE) * SCORE_PER_ESTIMATED_PAIR;
  }

  private trumpCardValue(rank: string): number {
    switch (rank) {
      case 'A':
        return 1.0;
      case 'K':
        return 0.8;
      case 'Q':
        return 0.6;
      case 'J':
        return 0.5;
      case '10':
        return 0.35;
      default:
        return 0.2;
    }
  }

  private offTrumpCardValue(rank: string): number {
    switch (rank) {
      case 'A':
        return 0.45;
      case 'K':
        return 0.3;
      case 'Q':
        return 0.2;
      default:
        return 0;
    }
  }

  private chooseLowestDiscard(
    cards: string[],
    trump: TrumpType | null,
  ): string {
    return this.minBy(cards, (card) => this.discardValue(card, trump, cards));
  }

  private chooseStrongestControlCard(
    cards: string[],
    trump: TrumpType | null,
  ): string {
    return this.maxBy(cards, (card) => this.controlValue(card, trump));
  }

  private chooseMiddleControlCard(
    cards: string[],
    trump: TrumpType | null,
  ): string {
    const sorted = [...cards].sort(
      (a, b) => this.controlValue(a, trump) - this.controlValue(b, trump),
    );
    const nonJoker = sorted.filter((card) => card !== 'JOKER');
    const source = nonJoker.length > 0 ? nonJoker : sorted;
    return source[Math.floor((source.length - 1) / 2)];
  }

  private controlValue(card: string, trump: TrumpType | null): number {
    if (card === 'JOKER') {
      return 10000;
    }

    const suit = this.cardService.getCardSuit(card, trump);
    return this.cardService.getCardStrength(card, suit, trump);
  }

  private discardValue(
    card: string,
    trump: TrumpType | null,
    hand: string[],
  ): number {
    if (card === 'JOKER') {
      return 10000;
    }

    const rank = this.getRank(card);
    const suit = this.cardService.getCardSuit(card, trump);
    const trumpSuit = trump ? TRUMP_TO_SUIT[trump] : '';
    const suitCount = hand.filter(
      (handCard) =>
        handCard !== 'JOKER' &&
        this.cardService.getCardSuit(handCard, trump) === suit,
    ).length;

    let value = this.rankDiscardValue(rank);

    if (trump && trump !== 'tra') {
      if (this.isPrimaryJack(card, trump)) {
        value += 9000;
      } else if (this.isSecondaryJack(card, trump)) {
        value += 8500;
      }
    }

    if (rank === 'J') {
      value += 1500;
    }

    if (trumpSuit && suit === trumpSuit) {
      value += 3000;
    }

    if (suitCount <= 1) {
      value -= 20;
    }

    return value;
  }

  private rankDiscardValue(rank: string): number {
    switch (rank) {
      case 'A':
        return 700;
      case 'K':
        return 600;
      case 'Q':
        return 500;
      case 'J':
        return 650;
      case '10':
        return 200;
      case '9':
        return 90;
      case '8':
        return 80;
      case '7':
        return 70;
      case '6':
        return 60;
      case '5':
        return 50;
      default:
        return 0;
    }
  }

  private isControlCard(card: string, trump: TrumpType | null): boolean {
    if (card === 'JOKER') {
      return true;
    }
    const rank = this.getRank(card);
    const suit = this.cardService.getCardSuit(card, trump);
    const trumpSuit = trump ? TRUMP_TO_SUIT[trump] : '';
    return (
      rank === 'A' ||
      rank === 'K' ||
      this.isPrimaryJack(card, trump) ||
      this.isSecondaryJack(card, trump) ||
      (trumpSuit !== '' && suit === trumpSuit)
    );
  }

  private baseSuitControlScore(
    hand: string[],
    suit: string,
    trump: TrumpType | null,
  ): number {
    const cards = hand.filter(
      (card) =>
        card !== 'JOKER' && this.cardService.getCardSuit(card, trump) === suit,
    );

    return cards.reduce((score, card) => {
      const rank = this.getRank(card);
      const strength = this.cardService.getCardStrength(card, suit, trump);
      const highBonus = ['A', 'K', 'Q', 'J', '10'].includes(rank) ? 18 : 0;
      return score + 20 + highBonus + strength / 10;
    }, 0);
  }

  private getCurrentWinningStrength(
    field: Field,
    baseSuit: string,
    trump: TrumpType | null,
  ): number {
    return Math.max(
      ...field.cards.map((card) =>
        this.cardService.getCardStrength(card, baseSuit, trump),
      ),
    );
  }

  private resolveFieldBaseSuit(field: Field, trump: TrumpType | null): string {
    if (field.baseCard === 'JOKER') {
      return field.baseSuit ?? '';
    }

    return this.cardService.getCardSuit(field.baseCard, trump, field.baseSuit);
  }

  private findDeclaringTeam(state: GameState): Team | null {
    const declaration = state.blowState.currentHighestDeclaration;
    if (!declaration) {
      return null;
    }
    return this.findPlayer(state, declaration.playerId)?.team ?? null;
  }

  private countCompletedFieldsByTeam(state: GameState, team: Team): number {
    return (
      state.playState?.fields.filter((field) => field.winnerTeam === team)
        .length ?? 0
    );
  }

  private findPlayer(state: GameState, playerId: string): DomainPlayer | null {
    return state.players.find((player) => player.playerId === playerId) ?? null;
  }

  private countSuits(
    hand: string[],
    trump: TrumpType | null,
  ): Map<string, number> {
    const counts = new Map<string, number>();
    for (const card of hand) {
      if (card === 'JOKER') {
        continue;
      }
      const suit = this.cardService.getCardSuit(card, trump);
      counts.set(suit, (counts.get(suit) ?? 0) + 1);
    }
    return counts;
  }

  private isPrimaryJack(card: string, trump: TrumpType | null): boolean {
    return (
      trump != null && trump !== 'tra' && card === this.getPrimaryJack(trump)
    );
  }

  private isSecondaryJack(card: string, trump: TrumpType | null): boolean {
    return (
      trump != null && trump !== 'tra' && card === this.getSecondaryJack(trump)
    );
  }

  private getPrimaryJack(trump: TrumpType): string {
    return `J${TRUMP_TO_SUIT[trump]}`;
  }

  private getSecondaryJack(trump: TrumpType): string {
    switch (trump) {
      case 'herz':
        return 'J♦';
      case 'daiya':
        return 'J♥';
      case 'club':
        return 'J♠';
      case 'zuppe':
        return 'J♣';
      case 'tra':
        return '';
    }
  }

  private getRank(card: string): string {
    if (card === 'JOKER') {
      return 'JOKER';
    }
    return card.startsWith('10') ? '10' : card[0];
  }

  private minBy<T>(items: T[], getValue: (item: T) => number): T {
    if (items.length === 0) {
      throw new Error('Cannot choose from an empty list');
    }

    return items.reduce((best, item) =>
      getValue(item) < getValue(best) ? item : best,
    );
  }

  private maxBy<T>(items: T[], getValue: (item: T) => number): T {
    if (items.length === 0) {
      throw new Error('Cannot choose from an empty list');
    }

    return items.reduce((best, item) =>
      getValue(item) > getValue(best) ? item : best,
    );
  }
}
