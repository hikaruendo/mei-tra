import { Injectable } from '@nestjs/common';
import {
  GameState,
  Player,
  BlowState,
  PlayState,
  Field,
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

  addPlayer(id: string, name: string): boolean {
    if (this.state.players.length >= 4) return false;

    const team = Math.floor(this.state.players.length / 2);
    this.state.players.push({ id, name, hand: [], team });
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

  completeField(): Field | null {
    const field = this.state.playState.currentField;
    if (!field) return null;

    field.isComplete = true;
    this.state.playState.fields.push(field);
    return field;
  }

  isGameOver(): boolean {
    return Object.values(this.state.teamScores).some(
      (score) => score.total >= 17,
    );
  }

  resetState(): void {
    this.initializeState();
    this.chomboService.clearViolations();
  }
}
