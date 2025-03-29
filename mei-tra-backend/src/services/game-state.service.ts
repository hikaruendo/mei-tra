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

// TODO: traの時のJの扱い

@Injectable()
export class GameStateService {
  private state: GameState;
  private reconnectTokens: Map<string, string> = new Map(); // playerId -> token
  private playerIds: Map<string, string> = new Map(); // token -> playerId
  private disconnectedPlayers: Map<string, NodeJS.Timeout> = new Map(); // 切断されたプレイヤーのタイマーを管理

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
      currentBlowIndex: 0,
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

  addPlayer(id: string, name: string, reconnectToken: string): boolean {
    if (this.state.players.length >= 4) return false;
    const team = (this.state.players.length % 2) as Team;
    this.state.players.push({ id, name, hand: [], team });

    // Store reconnect token
    this.reconnectTokens.set(id, reconnectToken);
    this.playerIds.set(reconnectToken, id);

    console.log(
      `Added player ${name} (${id}) to team ${team}. Total players: ${this.state.players.length}`,
    );
    return true;
  }

  removePlayer(id: string): void {
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;

    // プレイヤーが切断された場合、一定時間待つ
    const timeout = setTimeout(() => {
      // タイムアウト後にプレイヤーを削除
      this.state.players = this.state.players.filter((p) => p.id !== id);
      this.disconnectedPlayers.delete(id);

      // トークンのクリーンアップ
      const token = this.reconnectTokens.get(id);
      if (token) {
        this.reconnectTokens.delete(id);
        this.playerIds.delete(token);
      }
    }, 15000); // 15秒待つ

    this.disconnectedPlayers.set(id, timeout);
  }

  findPlayerByReconnectToken(token: string): Player | null {
    const playerId = this.playerIds.get(token);
    if (!playerId) return null;
    return this.state.players.find((p) => p.id === playerId) || null;
  }

  updatePlayerSocketId(oldId: string, newId: string): void {
    const player = this.state.players.find((p) => p.id === oldId);
    if (player) {
      // 再接続タイマーをクリア
      const timeout = this.disconnectedPlayers.get(oldId);
      if (timeout) {
        clearTimeout(timeout);
        this.disconnectedPlayers.delete(oldId);
      }

      player.id = newId;
      // トークンのマッピングを更新
      const token = this.reconnectTokens.get(oldId);
      if (token) {
        this.reconnectTokens.delete(oldId);
        this.reconnectTokens.set(newId, token);
        this.playerIds.set(token, newId);
      }
    }
  }

  dealCards(): void {
    if (this.state.players.length === 0) return;

    // Reset player hands and status
    this.state.players.forEach((player) => {
      player.hand = [];
      player.isPasser = false;
      player.hasBroken = false;
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

    this.state.players.forEach((player) => {
      this.chomboService.checkForBrokenHand(player);
    });
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

  isPlayerDisconnected(playerName: string): boolean {
    const player = this.state.players.find((p) => p.name === playerName);
    if (!player) return false;
    return this.disconnectedPlayers.has(player.id);
  }
}
