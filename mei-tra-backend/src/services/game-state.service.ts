import { Injectable, Inject } from '@nestjs/common';
import {
  GameState,
  Player,
  BlowState,
  PlayState,
  Field,
  Team,
  CompletedField,
  TeamScore,
  ScoreRecord,
  User,
} from '../types/game.types';
import { CardService } from './card.service';
import { ChomboService } from './chombo.service';
import { IGameStateRepository } from '../repositories/interfaces/game-state.repository.interface';
import { IGameStateService } from './interfaces/game-state-service.interface';

@Injectable()
export class GameStateService implements IGameStateService {
  private users: User[] = [];
  private state: GameState;
  private playerIds: Map<string, string> = new Map(); // token -> playerId
  private disconnectedPlayers: Map<string, NodeJS.Timeout> = new Map(); // 切断されたプレイヤーのタイマーを管理
  private roomId: string | null = null;

  constructor(
    private readonly cardService: CardService,
    private readonly chomboService: ChomboService,
    @Inject('IGameStateRepository')
    private readonly gameStateRepository: IGameStateRepository,
  ) {
    this.initializeState();
  }

  setRoomId(roomId: string): void {
    this.roomId = roomId;
  }

  private initializeState(pointsToWin: number = 10): void {
    this.state = {
      players: [],
      deck: [],
      currentPlayerIndex: 0,
      agari: undefined,
      teamScores: {
        0: { play: 0, total: 0 },
        1: { play: 0, total: 0 },
      } as Record<Team, TeamScore>,
      gamePhase: null,
      blowState: this.getInitialBlowState(),
      playState: this.getInitialPlayState(),
      teamScoreRecords: {
        0: [],
        1: [],
      } as Record<Team, ScoreRecord[]>,
      roundNumber: 1,
      pointsToWin,
      teamAssignments: {},
    };
  }

  private getInitialBlowState(): BlowState {
    return {
      currentTrump: null,
      currentHighestDeclaration: null,
      declarations: [],
      lastPasser: null,
      isRoundCancelled: false,
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
      openDeclared: false,
      openDeclarerId: null,
    };
  }

  getState(): GameState {
    return this.state;
  }

  getUsers(): User[] {
    return this.users;
  }

  async updateState(newState: Partial<GameState>): Promise<void> {
    this.state = {
      ...this.state,
      ...newState,
    };

    // Persist to database if roomId is set
    if (this.roomId) {
      try {
        await this.gameStateRepository.update(this.roomId, newState);
      } catch {
        // Continue with in-memory operation even if persistence fails
      }
    }
  }

  async loadState(roomId: string): Promise<void> {
    try {
      const persistedState =
        await this.gameStateRepository.findByRoomId(roomId);
      if (persistedState) {
        this.state = persistedState;
        this.roomId = roomId;

        // Rebuild playerIds map from persisted players
        // This is necessary because playerIds map is not persisted to database
        this.playerIds.clear();
        this.state.players.forEach((player) => {
          if (player.playerId) {
            // Use playerId as both token and playerId for simplicity
            this.playerIds.set(player.playerId, player.playerId);
          }
        });
      } else {
        // Initialize new state for this room
        this.roomId = roomId;
        await this.gameStateRepository.create(roomId, this.state);
      }
    } catch {
      // Fall back to in-memory state
      this.roomId = roomId;
    }
  }

  async configureGameSettings(pointsToWin: number): Promise<void> {
    this.state.pointsToWin = pointsToWin;

    // Persist the updated setting
    if (this.roomId) {
      try {
        await this.gameStateRepository.update(this.roomId, { pointsToWin });
      } catch {
        // Silent fail
      }
    }
  }

  async saveState(): Promise<void> {
    if (this.roomId) {
      try {
        await this.gameStateRepository.update(this.roomId, this.state);
      } catch {
        // Silent fail
      }
    }
  }

  addPlayer(
    socketId: string,
    name: string,
    userId?: string,
    isAuthenticated?: boolean,
  ): boolean {
    // Add new user - use userId as playerId for authenticated users
    const playerId = userId || this.generateReconnectToken();
    const users = this.getUsers();
    users.push({
      id: socketId,
      playerId,
      name,
      userId,
      isAuthenticated: isAuthenticated || false,
    });

    // Store userId mapping
    if (userId) {
      this.playerIds.set(userId, playerId);
    }

    return true;
  }

  updateUserName(socketId: string, name: string): boolean {
    const user = this.users.find((u) => u.id === socketId);
    if (!user) {
      return false;
    }
    user.name = name;
    return true;
  }

  private generateReconnectToken(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  removePlayer(playerId: string) {
    const player = this.state.players.find((p) => p.playerId === playerId);
    if (!player) return;

    // 15秒間、再接続を待つ
    this.disconnectedPlayers.set(
      playerId,
      setTimeout(() => {
        this.disconnectedPlayers.delete(playerId);
        this.state.players = this.state.players.filter(
          (p) => p.playerId !== playerId,
        );
      }, 15000),
    ); // 15秒待ってから削除

    // ソケットIDだけ即時クリア（切断状態を示す）
    player.id = '';
  }

  // プレイヤーの再接続トークンを登録
  registerPlayerToken(token: string, playerId: string): void {
    this.playerIds.set(token, playerId);
  }

  // プレイヤーの再接続トークンを削除
  removePlayerToken(playerId: string): void {
    // playerIdsマップから該当するトークンを検索して削除
    for (const [token, id] of this.playerIds.entries()) {
      if (id === playerId) {
        this.playerIds.delete(token);
        break;
      }
    }
  }

  findPlayerByUserId(userId: string): Player | null {
    // Find player by their Supabase userId
    // This works even if the player is disconnected (empty socket id)
    return this.state.players.find((p) => p.userId === userId) || null;
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

  async updatePlayerSocketId(
    playerId: string,
    newId: string,
    userId?: string,
  ): Promise<void> {
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

      // Update userId if provided (for authenticated users)
      if (userId) {
        player.userId = userId;
        console.log(
          `[GameState] Updated player ${playerId} with userId: ${userId}`,
        );
      }

      // Update token mappings
      const token = this.playerIds.get(player.playerId);
      if (token) {
        this.playerIds.set(token, player.playerId);
      }

      // Persist the player update
      if (this.roomId) {
        try {
          const updates: { id: string; userId?: string } = { id: newId };
          if (userId) {
            updates.userId = userId;
          }
          await this.gameStateRepository.updatePlayer(
            this.roomId,
            playerId,
            updates,
          );
        } catch (error) {
          console.error('Failed to persist player socket update:', error);
        }
      }
    }
  }

  async dealCards(): Promise<void> {
    if (this.state.players.length === 0) return;

    // Reset player hands and status
    this.state.players.forEach((player) => {
      player.hand = [];
      player.isPasser = false;
      player.hasBroken = false;
      player.hasRequiredBroken = false;
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

    // // For Test: Deal exactly 1 card to each player for testing
    // for (let i = 0; i < this.state.players.length; i++) {
    //   this.state.players[i].hand.push(this.state.deck[i]);
    // }

    // // Set the Agari card
    // this.state.agari = this.state.deck[this.state.players.length];

    // Sort each player's hand
    this.state.players.forEach((player) => {
      player.hand.sort((a, b) => this.cardService.compareCards(a, b));
    });

    this.state.players.forEach((player) => {
      this.chomboService.checkForBrokenHand(player);
      this.chomboService.checkForRequiredBrokenHand(player);
    });

    // Persist the updated state
    await this.saveState();
  }

  async nextTurn(): Promise<void> {
    if (this.state.players.length === 0) return;
    this.state.currentPlayerIndex =
      (this.state.currentPlayerIndex + 1) % this.state.players.length;

    // Persist the turn change
    if (this.roomId) {
      try {
        await this.gameStateRepository.updateCurrentPlayerIndex(
          this.roomId,
          this.state.currentPlayerIndex,
        );
      } catch (error) {
        console.error('Failed to persist turn change:', error);
      }
    }
  }

  getCurrentPlayer(): Player | null {
    return this.state.players[this.state.currentPlayerIndex] || null;
  }

  private arrangePlayersForSeatOrder(): void {
    if (this.state.players.length <= 1) {
      return;
    }

    const currentPlayerId =
      this.state.players[this.state.currentPlayerIndex]?.playerId || null;

    const team0 = this.state.players.filter((player) => player.team === 0);
    const team1 = this.state.players.filter((player) => player.team === 1);

    if (team0.length === 0 || team1.length === 0) {
      return;
    }

    const maxTeamSize = Math.max(team0.length, team1.length);
    const ordered: Player[] = [];

    for (let i = 0; i < maxTeamSize; i++) {
      if (team0[i]) {
        ordered.push(team0[i]);
      }
      if (team1[i]) {
        ordered.push(team1[i]);
      }
    }

    if (ordered.length !== this.state.players.length) {
      return;
    }

    this.state.players = ordered;

    if (currentPlayerId) {
      const newIndex = this.state.players.findIndex(
        (player) => player.playerId === currentPlayerId,
      );
      this.state.currentPlayerIndex = newIndex === -1 ? 0 : newIndex;
    } else {
      this.state.currentPlayerIndex = 0;
    }
  }

  isPlayerTurn(playerId: string): boolean {
    const currentPlayer = this.getCurrentPlayer();
    return currentPlayer?.playerId === playerId;
  }

  async completeField(
    field: Field,
    winnerId: string,
  ): Promise<CompletedField | null> {
    const state = this.getState();
    if (!state.playState) {
      return null;
    }

    const currentField = state.playState.currentField;
    if (!currentField) {
      return null;
    }

    field.isComplete = true;
    const completedField: CompletedField = {
      cards: field.cards,
      winnerId: winnerId,
      winnerTeam: state.players.find((p) => p.playerId === winnerId)?.team || 0,
      dealerId: field.dealerId,
    };

    state.playState.fields.push(completedField);

    // Persist the completed field
    await this.saveState();

    return completedField;
  }

  async resetState(): Promise<void> {
    this.initializeState();

    // Clear persisted state
    if (this.roomId) {
      try {
        await this.gameStateRepository.delete(this.roomId);
        await this.gameStateRepository.create(this.roomId, this.state);
      } catch (error) {
        console.error('Failed to reset persisted state:', error);
      }
    }
  }

  async resetRoundState(): Promise<void> {
    // Keep the current players, scores, and game settings
    const players = [...this.state.players];
    const teamScores = { ...this.state.teamScores };
    const teamScoreRecords = { ...this.state.teamScoreRecords };
    const pointsToWin = this.state.pointsToWin;

    // Initialize new state with preserved pointsToWin
    this.initializeState(pointsToWin);

    // Restore players and scores
    this.state.players = players;
    this.state.teamScores = teamScores;
    this.state.teamScoreRecords = teamScoreRecords;

    // Generate new deck and deal cards
    this.state.deck = this.cardService.generateDeck();
    await this.dealCards();
  }

  get roundNumber(): number {
    return this.state.roundNumber;
  }

  set roundNumber(value: number) {
    this.state.roundNumber = value;
    // Persist round number change
    if (this.roomId) {
      this.gameStateRepository
        .bulkUpdate(this.roomId, { round_number: value })
        .catch((error) =>
          console.error('Failed to persist round number:', error),
        );
    }
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
      // Persist turn change
      if (this.roomId) {
        this.gameStateRepository
          .updateCurrentPlayerIndex(this.roomId, playerIndex)
          .catch((error) =>
            console.error('Failed to persist turn change:', error),
          );
      }
    }
  }

  async startGame(): Promise<void> {
    const state = this.getState();

    // Arrange seats so partners sit opposite and turns follow seat order
    this.arrangePlayersForSeatOrder();

    // Initialize game state
    state.gamePhase = 'blow';
    state.deck = this.cardService.generateDeck();
    await this.dealCards();

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
      currentBlowIndex: 0,
    };

    // Persist the game start
    await this.saveState();
  }

  setDisconnectTimeout(playerId: string, timeout: NodeJS.Timeout): void {
    // Clear any existing timeout
    const existingTimeout = this.disconnectedPlayers.get(playerId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    // Set new timeout
    this.disconnectedPlayers.set(playerId, timeout);
  }
}
