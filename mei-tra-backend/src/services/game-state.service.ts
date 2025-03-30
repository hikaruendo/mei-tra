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

  addPlayer(socketId: string, name: string, reconnectToken?: string): boolean {
    const state = this.getState();
    if (state.players.length >= 4) return false;

    // 既存のプレイヤーを探す
    const existingPlayer = state.players.find(
      (p) => p.playerId === reconnectToken,
    );

    console.log('existingPlayer', existingPlayer);

    if (existingPlayer) {
      // 既存のプレイヤーのsocketIdを更新
      existingPlayer.id = socketId;
      // Update token mappings
      if (reconnectToken) {
        this.reconnectTokens.set(existingPlayer.playerId, reconnectToken);
        this.playerIds.set(reconnectToken, existingPlayer.playerId);
      }
      return true;
    }

    // 新しいプレイヤーを追加
    const playerId = reconnectToken || this.generateReconnectToken(); // 永続的なIDとして使用
    state.players.push({
      id: socketId,
      playerId,
      name,
      hand: [],
      team: (state.players.length % 2) as Team,
      isPasser: false,
    });

    console.log('playerId', playerId);

    // Store token mappings
    const token = reconnectToken || playerId;
    this.reconnectTokens.set(playerId, token);
    this.playerIds.set(token, playerId);

    return true;
  }

  private generateReconnectToken(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  removePlayer(playerId: string) {
    const player = this.state.players.find((p) => p.playerId === playerId);
    if (!player) return;

    const name = player.name;

    // 15秒間、再接続を待つ
    this.disconnectedPlayers.set(
      name,
      setTimeout(() => {
        this.disconnectedPlayers.delete(name);
        this.state.players = this.state.players.filter(
          (p) => p.playerId !== playerId,
        );
      }, 15000),
    ); // 15秒待ってから削除

    // ソケットIDだけ即時クリア（切断状態を示す）
    player.id = '';
  }

  findPlayerByReconnectToken(token: string): Player | null {
    // First try to find by token in playerIds map
    const playerId = this.playerIds.get(token);
    if (playerId) {
      // Look for the player in the player list by playerId,
      // even if the player's socket id is empty (meaning they disconnected)
      return this.state.players.find((p) => p.playerId === playerId) || null;
    }

    // If not found, try to find by playerId directly
    return this.state.players.find((p) => p.playerId === token) || null;
  }

  updatePlayerSocketId(playerId: string, newId: string): void {
    // Find the player by playerId, not by socket id
    const player = this.state.players.find((p) => p.playerId === playerId);

    if (player) {
      // Cancel reconnection timer if exists
      const timeout = this.disconnectedPlayers.get(playerId);
      if (timeout) {
        clearTimeout(timeout);
        this.disconnectedPlayers.delete(playerId);
      }

      // Update the socket ID
      player.id = newId;

      // Update token mappings
      const token = this.reconnectTokens.get(player.playerId);
      if (token) {
        this.playerIds.set(token, player.playerId);
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
    return currentPlayer?.playerId === playerId;
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
    return currentPlayer?.playerId || null;
  }

  set currentTurn(playerId: string) {
    const playerIndex = this.state.players.findIndex(
      (p) => p.playerId === playerId,
    );
    if (playerIndex !== -1) {
      this.state.currentPlayerIndex = playerIndex;
    }
  }

  isPlayerDisconnected(name: string): boolean {
    return this.disconnectedPlayers.has(name);
  }

  startGame(): void {
    const state = this.getState();

    // Initialize game state
    state.gamePhase = 'blow';
    state.deck = this.cardService.generateDeck();
    this.dealCards();

    // Initialize play state
    state.playState = {
      currentField: {
        cards: [],
        baseCard: '',
        dealerId: state.players[0].playerId,
        isComplete: false,
      },
      negriCard: null,
      neguri: {},
      fields: [],
      lastWinnerId: null,
      isTanzenRound: false,
      openDeclared: false,
      openDeclarerId: null,
    };

    // Initialize blow state
    state.blowState = {
      currentTrump: null,
      currentHighestDeclaration: null,
      declarations: [],
      lastPasser: null,
      isRoundCancelled: false,
      startingPlayerId: null,
      currentBlowIndex: 0,
    };
  }

  getDisconnectTimeout(name: string): NodeJS.Timeout | undefined {
    return this.disconnectedPlayers.get(name);
  }

  clearDisconnectTimeout(name: string): void {
    const timeout = this.disconnectedPlayers.get(name);
    if (timeout) {
      clearTimeout(timeout);
      this.disconnectedPlayers.delete(name);
    }
  }
}
