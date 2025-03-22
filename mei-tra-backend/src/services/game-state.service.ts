import { Injectable } from '@nestjs/common';
import {
  GameState,
  Player,
  BlowState,
  PlayState,
  Field,
  Team,
  CompletedField,
} from '../types/game.types';
import { CardService } from './card.service';
import { ScoreService } from './score.service';
import { ChomboService } from './chombo.service';

@Injectable()
export class GameStateService {
  private state: GameState;

  constructor(
    private readonly cardService: CardService,
    private readonly scoreService: ScoreService,
    private readonly chomboService: ChomboService,
  ) {
    this.initializeState();
  }

  private initializeState(): void {
    this.state = {
      players: [],
      deck: [],
      currentPlayerIndex: 0,
      agari: null,
      teamScores: this.scoreService.initializeTeamScores(),
      gamePhase: null,
      blowState: this.getInitialBlowState(),
      playState: this.getInitialPlayState(),
      teamScoreRecords: this.scoreService.initializeTeamScoreRecords(),
      chomboViolations: [],
      currentTrump: null,
      roundNumber: 1,
    };
  }

  private getInitialBlowState(): BlowState {
    return {
      currentTrump: null,
      currentHighestDeclaration: null,
      declarations: [],
      lastPasser: null,
      isRoundCancelled: false,
      startingPlayerId: null,
    };
  }

  private getInitialPlayState(): PlayState {
    return {
      currentField: null,
      negriCard: null,
      neguri: {},
      fields: [],
      lastWinnerId: null,
      isTanzenRound: false,
      openDeclared: false,
      openDeclarerId: null,
    };
  }

  getState(): GameState {
    return this.state;
  }

  updateState(newState: Partial<GameState>): void {
    this.state = {
      ...this.state,
      ...newState,
    };
  }

  addPlayer(id: string, name: string): boolean {
    if (this.state.players.length >= 4) return false;
    const team = (this.state.players.length % 2) as Team;
    this.state.players.push({ id, name, hand: [], team });
    console.log(
      `Added player ${name} (${id}) to team ${team}. Total players: ${this.state.players.length}`,
    );
    return true;
  }

  removePlayer(id: string): void {
    this.state.players = this.state.players.filter((p) => p.id !== id);
  }

  startGame(): boolean {
    if (this.state.players.length !== 4) return false;

    this.state.teamScores = this.scoreService.initializeTeamScores();
    this.state.agari = null;
    this.state.gamePhase = 'deal';
    this.state.deck = this.cardService.generateDeck();
    this.dealCards();
    this.state.currentPlayerIndex = 0;

    return true;
  }

  dealCards(): void {
    if (this.state.players.length === 0) return;

    // Reset player hands and status
    this.state.players.forEach((player) => {
      player.hand = [];
      player.isPasser = false;
    });

    // Deal exactly 10 cards to each player
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < this.state.players.length; j++) {
        this.state.players[j].hand.push(
          this.state.deck[i * this.state.players.length + j],
        );
      }
    }

    // Set the Agari card
    this.state.agari = this.state.deck[40];
  }

  nextTurn(): void {
    if (this.state.players.length === 0) return;
    this.state.currentPlayerIndex =
      (this.state.currentPlayerIndex + 1) % this.state.players.length;
  }

  getCurrentPlayer(): Player | null {
    return this.state.players[this.state.currentPlayerIndex] || null;
  }

  isPlayerTurn(playerId: string): boolean {
    const currentPlayer = this.getCurrentPlayer();
    return currentPlayer?.id === playerId;
  }

  updatePhase(phase: 'deal' | 'blow' | 'play' | null): void {
    this.state.gamePhase = phase;
  }

  startField(dealerId: string): void {
    const isTanzenRound = this.state.players.some((p) => p.hand.length === 2);

    this.state.playState.currentField = {
      cards: [],
      baseCard: '',
      dealerId,
      isComplete: false,
    };
    this.state.playState.isTanzenRound = isTanzenRound;
  }

  completeField(field: Field, winnerId: string): CompletedField | null {
    const state = this.getState();
    const currentField = state.playState.currentField;

    if (!currentField) {
      return null;
    }

    field.isComplete = true;
    const completedField: CompletedField = {
      cards: field.cards,
      winnerId: winnerId,
      winnerTeam: state.players.find((p) => p.id === winnerId)?.team || 0,
      dealerId: field.dealerId,
    };

    this.state.playState.fields.push(completedField);
    return completedField;
  }

  isGameOver(): boolean {
    return Object.values(this.state.teamScores).some(
      // TODO: テストで３点にする
      (score) => score.total >= 3,
      // (score) => score.total >= 17,
    );
  }

  resetState(): void {
    this.initializeState();
  }

  resetRoundState(): void {
    // Keep the current players and scores
    const players = [...this.state.players];
    const teamScores = { ...this.state.teamScores };
    const teamScoreRecords = { ...this.state.teamScoreRecords };

    // Initialize new state
    this.initializeState();

    // Restore players and scores
    this.state.players = players;
    this.state.teamScores = teamScores;
    this.state.teamScoreRecords = teamScoreRecords;

    // Generate new deck and deal cards
    this.state.deck = this.cardService.generateDeck();
    this.dealCards();
  }

  private handleFieldComplete(field: Field, winnerId: string): void {
    const winner = this.state.players.find((p) => p.id === winnerId);
    if (!winner) return;

    const completedField: CompletedField = {
      cards: field.cards,
      winnerId: winnerId,
      winnerTeam: winner.team,
      dealerId: field.dealerId,
    };

    this.state.playState.fields.push(completedField);
  }

  resetCurrentField(): void {
    this.state.playState.currentField = null;
  }

  get roundNumber(): number {
    return this.state.roundNumber;
  }

  set roundNumber(value: number) {
    this.state.roundNumber = value;
  }

  get currentTurn(): string | null {
    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    return currentPlayer?.id || null;
  }

  set currentTurn(playerId: string) {
    const playerIndex = this.state.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== -1) {
      this.state.currentPlayerIndex = playerIndex;
    }
  }
}
