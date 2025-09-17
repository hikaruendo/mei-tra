import { GameState, Player } from '../../types/game.types';

export interface IGameStateRepository {
  // Game state CRUD operations
  create(roomId: string, gameState: GameState): Promise<GameState>;
  findByRoomId(roomId: string): Promise<GameState | null>;
  update(
    roomId: string,
    gameState: Partial<GameState>,
  ): Promise<GameState | null>;
  delete(roomId: string): Promise<void>;

  // Player management in game state
  updatePlayers(roomId: string, players: Player[]): Promise<boolean>;
  updatePlayer(
    roomId: string,
    playerId: string,
    updates: Partial<Player>,
  ): Promise<boolean>;

  // Game phase management
  updateGamePhase(roomId: string, phase: string): Promise<boolean>;
  updateCurrentPlayerIndex(roomId: string, index: number): Promise<boolean>;

  // Bulk operations for performance
  bulkUpdate(roomId: string, updates: Record<string, any>): Promise<boolean>;

  // Cleanup operations
  deleteExpiredGameStates(expiryTime: number): Promise<number>;
}
