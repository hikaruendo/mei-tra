import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  GameState,
  DomainPlayer,
  BlowState,
  PlayState,
  Field,
  Team,
  CompletedField,
  TeamScore,
  ScoreRecord,
  GamePhase,
} from '../types/game.types';
import { CardService } from './card.service';
import { ChomboService } from './chombo.service';
import { IGameStateRepository } from '../repositories/interfaces/game-state.repository.interface';
import { IGameStateService } from './interfaces/game-state-service.interface';
import { GameStateManager } from './game-state-manager.service';
import { PlayerConnectionManager } from './player-connection-manager.service';
import { GamePhaseService } from './game-phase.service';
import { PlayerConnectionState, SessionUser } from '../types/session.types';
import {
  toDomainPlayer,
  toRuntimePlayer,
  toTransportPlayers,
  TransportPlayer,
} from '../types/player-adapters';
import { RoomPlayer } from '../types/room.types';

@Injectable()
export class GameStateService implements IGameStateService {
  private readonly logger = new Logger(GameStateService.name);
  private state: GameState;
  private roomId: string | null = null;
  private readonly stateManager: GameStateManager;
  private readonly connectionManager: PlayerConnectionManager;
  private readonly playerIds: Map<string, string>;
  private readonly disconnectedPlayers: Map<string, NodeJS.Timeout>;
  private readonly gamePhaseService: GamePhaseService;
  private persistenceQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly cardService: CardService,
    private readonly chomboService: ChomboService,
    @Inject('IGameStateRepository')
    private readonly gameStateRepository: IGameStateRepository,
  ) {
    this.gamePhaseService = new GamePhaseService();
    this.stateManager = new GameStateManager(
      this.gameStateRepository,
      this.logger,
      this.gamePhaseService,
    );
    this.connectionManager = new PlayerConnectionManager(this.logger);
    this.playerIds = this.connectionManager.playerIds;
    this.disconnectedPlayers = this.connectionManager.disconnectedPlayers;
    this.initializeState();
  }

  setRoomId(roomId: string): void {
    this.roomId = roomId;
  }

  private initializeState(pointsToWin: number = 10): void {
    this.state = {
      version: 0,
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
      pendingBrokenHandReveal: null,
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
      actionHistory: [],
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

  private sanitizePlayers(): boolean {
    const rawPlayers = Array.isArray(this.state.players)
      ? this.state.players
      : [];
    const sanitizedPlayers: DomainPlayer[] = [];
    let changed = !Array.isArray(this.state.players);
    let warnNeeded = !Array.isArray(this.state.players);

    for (const rawPlayer of rawPlayers) {
      const normalizedPlayer = toRuntimePlayer(
        rawPlayer as Partial<DomainPlayer>,
      );
      if (!normalizedPlayer) {
        changed = true;
        warnNeeded = true;
        continue;
      }

      if (
        !Array.isArray(rawPlayer.hand) ||
        rawPlayer.isPasser === undefined ||
        rawPlayer.hasBroken === undefined ||
        rawPlayer.hasRequiredBroken === undefined
      ) {
        changed = true;
      }

      sanitizedPlayers.push(normalizedPlayer);
    }

    if (changed) {
      this.state.players = sanitizedPlayers;

      if (warnNeeded) {
        const roomLabel = this.roomId ?? 'unknown-room';
        this.logger.warn(
          `Sanitized malformed players in game state for ${roomLabel}`,
        );
      }
    }

    const normalizedIndex =
      this.state.players.length === 0
        ? 0
        : Number.isInteger(this.state.currentPlayerIndex)
          ? Math.min(
              Math.max(this.state.currentPlayerIndex, 0),
              this.state.players.length - 1,
            )
          : 0;

    if (normalizedIndex !== this.state.currentPlayerIndex) {
      this.state.currentPlayerIndex = normalizedIndex;
      changed = true;
    }

    return changed;
  }

  getState(): GameState {
    this.sanitizePlayers();
    return this.state;
  }

  getSessionUsers(): SessionUser[] {
    return this.connectionManager.getSessionUsers();
  }

  getTransportPlayers(
    players: DomainPlayer[] = this.state.players,
    roomPlayers?: RoomPlayer[],
  ): TransportPlayer[] {
    return toTransportPlayers(players, {
      getConnectionState: (playerId) =>
        this.connectionManager.getPlayerConnectionState(playerId),
      roomPlayers,
    });
  }

  findSessionUserBySocketId(socketId: string): SessionUser | null {
    return this.connectionManager.findSessionUserBySocketId(socketId);
  }

  findSessionUserByUserId(userId: string): SessionUser | null {
    return this.connectionManager.findSessionUserByUserId(userId);
  }

  findSessionUserByPlayerId(playerId: string): SessionUser | null {
    return this.connectionManager.findSessionUserByPlayerId(playerId);
  }

  upsertSessionUser(sessionUser: SessionUser): {
    user: SessionUser;
    created: boolean;
    changed: boolean;
  } {
    return this.connectionManager.upsertSessionUser(sessionUser);
  }

  private enqueuePersistence<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.persistenceQueue.then(operation, operation);
    this.persistenceQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async updateState(newState: Partial<GameState>): Promise<void> {
    this.state = await this.enqueuePersistence(() =>
      this.stateManager.updateState(this.roomId, this.state, newState),
    );
  }

  async transitionPhase(nextPhase: GamePhase): Promise<void> {
    this.state = await this.enqueuePersistence(() =>
      this.stateManager.transitionPhase(this.roomId, this.state, nextPhase),
    );
  }

  async loadState(roomId: string): Promise<void> {
    this.roomId = roomId;
    const persistedState = await this.stateManager.loadState(
      roomId,
      this.state,
    );
    if (persistedState) {
      this.state = persistedState;

      const sanitized = this.sanitizePlayers();
      if (sanitized) {
        this.state = await this.stateManager.updateState(roomId, this.state, {
          players: this.state.players,
          currentPlayerIndex: this.state.currentPlayerIndex,
        });
      }

      this.state.players.forEach((player) => {
        if (player.playerId) {
          this.connectionManager.registerPlayerToken(
            player.playerId,
            player.playerId,
          );
        }
      });
    }
  }

  async configureGameSettings(pointsToWin: number): Promise<void> {
    this.state = await this.enqueuePersistence(() =>
      this.stateManager.configureGameSettings(
        this.roomId,
        this.state,
        pointsToWin,
      ),
    );
  }

  async saveState(): Promise<void> {
    this.state = await this.enqueuePersistence(() =>
      this.stateManager.saveState(this.roomId, this.state),
    );
  }

  async persistRoster(
    roomPlayers: RoomPlayer[],
    hostId?: string,
  ): Promise<void> {
    this.state = await this.enqueuePersistence(() =>
      this.stateManager.persistRoster(
        this.roomId,
        roomPlayers,
        this.state,
        hostId,
      ),
    );
  }

  async reconcileWaitingRoomPlayers(roomPlayers: RoomPlayer[]): Promise<void> {
    const previousPlayers = this.state.players;
    const previousTeamAssignments = this.state.teamAssignments;
    const currentPlayers = new Map(
      this.state.players.map((player) => [player.playerId, player]),
    );

    this.state.players = roomPlayers.map((roomPlayer) => {
      const currentPlayer = currentPlayers.get(roomPlayer.playerId);
      if (!currentPlayer) {
        return toDomainPlayer(roomPlayer);
      }

      return toDomainPlayer({
        ...roomPlayer,
        hand: currentPlayer.hand,
        isPasser: currentPlayer.isPasser,
        hasBroken: currentPlayer.hasBroken,
        hasRequiredBroken: currentPlayer.hasRequiredBroken,
      });
    });
    this.state.teamAssignments = Object.fromEntries(
      roomPlayers.map((player) => [player.playerId, player.team]),
    );

    roomPlayers.forEach((player) => {
      this.connectionManager.registerPlayerToken(
        player.playerId,
        player.playerId,
      );
      if (player.userId) {
        this.connectionManager.registerPlayerToken(
          player.userId,
          player.playerId,
        );
      }
    });

    const hostId = roomPlayers.find((player) => player.isHost)?.playerId;
    try {
      await this.persistRoster(roomPlayers, hostId);
    } catch (error) {
      this.state.players = previousPlayers;
      this.state.teamAssignments = previousTeamAssignments;
      throw error;
    }
  }

  addPlayer(
    socketId: string,
    name: string,
    userId?: string,
    isAuthenticated?: boolean,
  ): boolean {
    return this.connectionManager.addPlayer(
      socketId,
      name,
      userId,
      isAuthenticated,
    );
  }

  updateUserNameBySocketId(socketId: string, name: string): boolean {
    return this.connectionManager.updateUserNameBySocketId(socketId, name);
  }

  findPlayerByActorId(actorId: string): DomainPlayer | null {
    const sessionUser =
      this.connectionManager.findSessionUserByUserId(actorId) ??
      this.connectionManager.findSessionUserByPlayerId(actorId);

    if (sessionUser) {
      return (
        this.state.players.find(
          (player) => player.playerId === sessionUser.playerId,
        ) || null
      );
    }

    return (
      this.connectionManager.findPlayerByReconnectToken(
        this.state.players,
        actorId,
      ) ?? null
    );
  }

  findPlayerBySocketId(socketId: string): DomainPlayer | null {
    const sessionUser =
      this.connectionManager.findSessionUserBySocketId(socketId);
    if (!sessionUser) {
      return null;
    }

    return (
      this.state.players.find(
        (player) => player.playerId === sessionUser.playerId,
      ) ?? null
    );
  }

  removePlayer(playerId: string) {
    this.connectionManager.removePlayer(this.state.players, playerId);
  }

  // プレイヤーの再接続トークンを登録
  registerPlayerToken(token: string, playerId: string): void {
    this.connectionManager.registerPlayerToken(token, playerId);
  }

  // プレイヤーの再接続トークンを削除
  removePlayerToken(playerId: string): void {
    this.connectionManager.removePlayerToken(playerId);
  }

  findPlayerByUserId(userId: string): DomainPlayer | null {
    return this.connectionManager.findPlayerByUserId(
      this.state.players,
      userId,
    );
  }

  findPlayerByReconnectToken(token: string): DomainPlayer | null {
    return this.connectionManager.findPlayerByReconnectToken(
      this.state.players,
      token,
    );
  }

  async updatePlayerSocketId(
    playerId: string,
    socketId: string,
    userId?: string,
  ): Promise<void> {
    const player = this.state.players.find(
      (candidate) => candidate.playerId === playerId,
    );
    if (!player) {
      return;
    }

    await this.applyPlayerConnectionState(playerId, {
      socketId,
      userId,
      isAuthenticated: userId ? true : undefined,
    });
  }

  async applyPlayerConnectionState(
    playerId: string,
    connectionState: PlayerConnectionState,
  ): Promise<void> {
    const player = this.state.players.find(
      (candidate) => candidate.playerId === playerId,
    );
    if (!player) {
      return;
    }

    this.connectionManager.applyConnectionState(
      playerId,
      player.name,
      connectionState,
    );

    const updates: {
      socketId: string;
      userId?: string;
      isAuthenticated?: boolean;
    } = { socketId: connectionState.socketId };
    if (connectionState.userId !== undefined) {
      updates.userId = connectionState.userId;
    }
    if (connectionState.isAuthenticated !== undefined) {
      updates.isAuthenticated = connectionState.isAuthenticated;
    }

    await this.stateManager.persistPlayerConnectionUpdate(
      this.roomId,
      playerId,
      updates,
    );
  }

  getPlayerConnectionState(playerId: string): PlayerConnectionState | null {
    return this.connectionManager.getPlayerConnectionState(playerId);
  }

  async dealCards(): Promise<void> {
    if (this.state.players.length === 0) return;

    // Validate deck exists and has correct size
    if (!this.state.deck || this.state.deck.length !== 41) {
      throw new Error(
        `Invalid deck: expected 41 cards, got ${this.state.deck?.length || 0}`,
      );
    }

    // Validate all players have initialized hand arrays
    for (const player of this.state.players) {
      if (!Array.isArray(player.hand)) {
        throw new Error(
          `Player ${player.playerId} has invalid hand: ${typeof player.hand}`,
        );
      }
    }

    // Reset player hands and status
    this.state.players.forEach((player) => {
      player.hand = [];
      player.isPasser = false;
      player.hasBroken = false;
      player.hasRequiredBroken = false;
    });
    this.state.pendingBrokenHandReveal = null;

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
        this.state.version = await this.enqueuePersistence(() =>
          this.stateManager.persistCurrentPlayerIndex(
            this.roomId,
            this.state,
            this.state.currentPlayerIndex,
          ),
        );
      } catch {
        // Keep in-memory turn changes even if persistence fails.
      }
    }
  }

  getCurrentPlayer(): DomainPlayer | null {
    return this.state.players[this.state.currentPlayerIndex] || null;
  }

  isPlayerTurn(playerId: string): boolean {
    const currentPlayer = this.getCurrentPlayer();
    return currentPlayer?.playerId === playerId;
  }

  completeField(field: Field, winnerId: string): CompletedField | null {
    const state = this.getState();
    if (!state.playState) {
      return null;
    }

    const currentField = state.playState.currentField;
    if (!currentField) {
      return null;
    }

    field.isComplete = true;
    const winnerTeam =
      state.players.find((p) => p.playerId === winnerId)?.team ?? (0 as const);
    const completedField: CompletedField = {
      cards: [...field.cards],
      winnerId: winnerId,
      winnerTeam,
      dealerId: field.dealerId,
    };

    state.playState.fields.push(completedField);

    return completedField;
  }

  async resetState(): Promise<void> {
    this.initializeState();

    // Clear persisted state
    await this.enqueuePersistence(() =>
      this.stateManager.resetState(this.roomId, this.state),
    );
  }

  async resetRoundState(): Promise<void> {
    // Keep the current players, scores, and game settings
    const version = this.state.version;
    const players = [...this.state.players];
    const teamScores = { ...this.state.teamScores };
    const teamScoreRecords = { ...this.state.teamScoreRecords };
    const teamAssignments = { ...this.state.teamAssignments };
    const pointsToWin = this.state.pointsToWin;

    // Initialize new state with preserved pointsToWin
    this.initializeState(pointsToWin);

    // Restore players and scores
    this.state.version = version;
    this.state.players = players;
    this.state.teamScores = teamScores;
    this.state.teamScoreRecords = teamScoreRecords;
    this.state.teamAssignments = teamAssignments;

    // Generate new deck and deal cards
    this.state.deck = this.cardService.generateDeck();
    await this.dealCards();
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
      void this.enqueuePersistence(() =>
        this.stateManager.persistCurrentPlayerIndex(
          this.roomId,
          this.state,
          playerIndex,
        ),
      )
        .then((version) => {
          this.state.version = version;
        })
        .catch((error) => {
          this.logger.error('Failed to persist turn change:', error);
        });
    }
  }

  async startGame(): Promise<void> {
    await this.transitionPhase('blow');
    let state = this.getState();

    // Initialize game state
    state.deck = this.cardService.generateDeck();
    await this.dealCards();
    state = this.getState();

    // Initialize play state
    state.playState = {
      currentField: {
        cards: [],
        playedBy: [],
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

    // Randomize the first blow player
    const firstBlowIndex = Math.floor(Math.random() * state.players.length);
    state.currentPlayerIndex = firstBlowIndex;

    // Initialize blow state
    state.blowState = {
      currentTrump: null,
      currentHighestDeclaration: null,
      declarations: [],
      actionHistory: [],
      lastPasser: null,
      isRoundCancelled: false,
      currentBlowIndex: firstBlowIndex,
    };

    // Persist the game start
    await this.saveState();
  }

  setDisconnectTimeout(playerId: string, timeout: NodeJS.Timeout): void {
    this.connectionManager.setDisconnectTimeout(playerId, timeout);
  }

  clearDisconnectTimeout(playerId: string): void {
    this.connectionManager.clearDisconnectTimeout(playerId);
  }
}
