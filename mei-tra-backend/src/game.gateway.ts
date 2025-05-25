import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameStateService } from './services/game-state.service';
import { CardService } from './services/card.service';
import { ScoreService } from './services/score.service';
import { BlowService } from './services/blow.service';
import { PlayService } from './services/play.service';
import { RoomService } from './services/room.service';
import { TrumpType, Field, Team, User } from './types/game.types';
import { ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { RoomStatus } from './types/room.types';
import { ChomboService } from './services/chombo.service';
@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private playerRooms: Map<string, string> = new Map(); // socketId -> roomId

  constructor(
    private readonly gameState: GameStateService,
    private readonly cardService: CardService,
    private readonly scoreService: ScoreService,
    private readonly blowService: BlowService,
    private readonly playService: PlayService,
    private readonly chomboService: ChomboService,
    private readonly roomService: RoomService,
  ) {}

  //-------Connection-------
  handleConnection(client: Socket) {
    const auth = client.handshake.auth || {};
    const token =
      typeof auth.reconnectToken === 'string' ? auth.reconnectToken : undefined;
    const name = typeof auth.name === 'string' ? auth.name : undefined;
    const roomId = typeof auth.roomId === 'string' ? auth.roomId : undefined;

    // トークンがある場合は再接続として処理
    if (token && roomId) {
      // ルームのゲーム状態を取得
      void this.roomService.getRoomGameState(roomId).then((roomGameState) => {
        if (!roomGameState) {
          client.emit('error-message', 'Game state not found');
          client.disconnect();
          return;
        }

        const existingPlayer = roomGameState.findPlayerByReconnectToken(token);

        if (existingPlayer) {
          // ルームサービスで再接続処理
          void this.roomService
            .handlePlayerReconnection(
              roomId,
              existingPlayer.playerId,
              client.id,
            )
            .then((result) => {
              if (!result.success) {
                client.emit('error-message', 'Failed to reconnect');
                client.disconnect();
                return;
              }

              // ルームに参加
              this.playerRooms.set(client.id, roomId);
              void client.join(roomId);

              const state = roomGameState.getState();

              // ゲーム状態をクライアントに送信
              this.server.to(client.id).emit('game-state', {
                players: state.players.map((player) => ({
                  ...player,
                  hand:
                    player.playerId === existingPlayer.playerId
                      ? player.hand
                      : [], // 自分の手札のみ表示
                })),
                gamePhase: state.gamePhase || 'waiting',
                currentField: state.playState?.currentField,
                currentTurn:
                  state.currentPlayerIndex !== -1 &&
                  state.players[state.currentPlayerIndex]
                    ? state.players[state.currentPlayerIndex].playerId
                    : null,
                blowState: state.blowState,
                teamScores: state.teamScores,
                you: existingPlayer.playerId,
                negriCard: state.playState?.negriCard,
                fields: state.playState?.fields,
                roomId: roomId,
                pointsToWin: state.pointsToWin,
              });
              this.server.to(roomId).emit('update-players', state.players);
            });
        } else {
          client.emit('error-message', 'Player not found1');
          client.disconnect();
        }
      });
      return;
    }

    // 新規プレイヤーとして追加
    if (name) {
      if (this.gameState.addPlayer(client.id, name, token)) {
        const users = this.gameState.getUsers();
        const newUser = users.find((p) => p.id === client.id);

        if (newUser) {
          this.server
            .to(client.id)
            .emit('reconnect-token', `${newUser.playerId}`);
          this.server.emit('update-users', users);
        }
      } else {
        client.emit('error-message', 'Game is full!');
        client.disconnect();
      }
    } else {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const roomId = this.playerRooms.get(client.id);
    if (roomId) {
      this.playerRooms.delete(client.id);
      void client.leave(roomId);

      // Get room-specific game state
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const player = state.players.find((p) => p.id === client.id);

      if (player) {
        // プレイヤーのチーム情報を保持
        state.teamAssignments[player.playerId] = player.team;

        // Notify other players in the same room about the disconnection
        this.server.to(roomId).emit('player-left', {
          playerId: player.playerId,
          roomId,
        });

        // Set a timeout to remove the player if they don't reconnect
        const timeout: NodeJS.Timeout = setTimeout(() => {
          roomGameState.removePlayer(player.playerId);
          this.server
            .to(roomId)
            .emit('update-players', roomGameState.getState().players);
        }, 10000); // 10 seconds timeout

        // Store the timeout ID for potential cancellation on reconnection
        roomGameState.setDisconnectTimeout(player.playerId, timeout);
      }
    }
  }
  //-------Connection-------

  //-------Room-------
  @SubscribeMessage('create-room')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      name: string;
      pointsToWin: number;
      teamAssignmentMethod: 'random' | 'host-choice';
    },
  ) {
    try {
      const auth = client.handshake.auth || {};
      const name = typeof auth.name === 'string' ? auth.name : undefined;
      if (!name) {
        client.emit('error-message', 'Name is required');
        return;
      }

      const users = this.gameState.getUsers();
      const user = users.find((p) => p.id === client.id);
      if (!user) {
        client.emit('error-message', 'Player not found2');
        return;
      }

      const room = await this.roomService.createNewRoom(
        data.name,
        user.playerId,
        data.pointsToWin,
        data.teamAssignmentMethod,
      );
      if (!room) {
        client.emit('error-message', 'Failed to create room');
        return;
      }

      this.playerRooms.set(client.id, room.id);
      await client.join(room.id);

      // ルーム一覧を更新
      const rooms = await this.roomService.listRooms();
      this.server.emit('rooms-list', rooms);

      // 作成したルームの情報を返す
      return { success: true, room };
    } catch (error) {
      console.error('Error in handleCreateRoom:', error);
      client.emit('error-message', 'Failed to create room');
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; user: User },
  ) {
    try {
      // 既存のルームから退出
      const currentRoom = this.playerRooms.get(client.id);
      if (currentRoom) {
        await client.leave(currentRoom);
        this.server.to(currentRoom).emit('player-left', {
          playerId: data.user.playerId,
          roomId: currentRoom,
        });
      }

      const success = await this.roomService.joinRoom(data.roomId, data.user);
      if (!success) {
        client.emit('error-message', 'Failed to join room');
        return { success: false };
      }

      this.playerRooms.set(client.id, data.roomId);
      await client.join(data.roomId);
      const room = await this.roomService.getRoom(data.roomId);
      const isHost = room?.hostId === data.user.playerId;
      const roomStatus = room?.status;
      // ルーム関連のイベント
      this.server.to(data.roomId).emit('room-player-joined', {
        playerId: data.user.playerId,
        roomId: data.roomId,
        isHost,
      });

      // ゲーム関連のイベント
      this.server.to(data.roomId).emit('game-player-joined', {
        playerId: data.user.playerId,
        roomId: data.roomId,
        isHost,
        roomStatus,
      });

      // ルーム一覧を更新
      const rooms = await this.roomService.listRooms();
      this.server.emit('rooms-list', rooms);
      this.server.to(data.roomId).emit('set-room-id', data.roomId);

      if (room && room.status === RoomStatus.PLAYING) {
        // 新しいプレイヤーが参加して4人になったらゲーム再開
        const roomGameState = await this.roomService.getRoomGameState(
          data.roomId,
        );
        const state = roomGameState.getState();
        const actualPlayerCount = room.players.filter(
          (p) => !p.playerId.startsWith('dummy-'),
        ).length;
        if (room && actualPlayerCount === 4 && state.gamePhase === null) {
          this.server
            .to(room.id)
            .emit('game-resumed', { message: 'Game resumed with 4 players.' });
          this.server.to(room.id).emit('game-state', {
            players: state.players,
            gamePhase: state.gamePhase,
            currentField: state.playState?.currentField,
            currentTurn:
              state.currentPlayerIndex !== -1 &&
              state.players[state.currentPlayerIndex]
                ? state.players[state.currentPlayerIndex].playerId
                : null,
            blowState: state.blowState,
            teamScores: state.teamScores,
            negriCard: state.playState?.negriCard,
            fields: state.playState?.fields,
            roomId: room.id,
            pointsToWin: room.settings.pointsToWin,
          });
        }
      }

      return { success: true, room };
    } catch (error) {
      console.error('Failed to join room:', error);
      client.emit('error-message', 'Failed to join room');
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('list-rooms')
  async handleListRooms(client: Socket) {
    try {
      const rooms = await this.roomService.listRooms();
      client.emit('rooms-list', rooms);
    } catch (error) {
      console.error('Failed to list rooms:', error);
    }
  }

  @SubscribeMessage('toggle-player-ready')
  async handleTogglePlayerReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string },
  ) {
    try {
      const room = await this.roomService.getRoom(data.roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      const player = room.players.find((p) => p.playerId === data.playerId);
      if (!player) {
        return { success: false, error: 'Player not found3 in room' };
      }

      // プレイヤーの準備状態を切り替え
      player.isReady = !player.isReady;
      room.updatedAt = new Date();

      // 全員が準備完了しているか確認
      const allReady = room.players.every((p) => p.isReady);
      const actualPlayerCount = room.players.filter(
        (p) => !p.playerId.startsWith('dummy-'),
      ).length;
      const hasMaxPlayers = actualPlayerCount === room.settings.maxPlayers;

      // ルームのステータスを更新
      room.status =
        allReady && hasMaxPlayers ? RoomStatus.READY : RoomStatus.WAITING;

      // ルームの更新を保存
      const updatedRoom = await this.roomService.updateRoom(data.roomId, room);
      if (!updatedRoom) {
        return { success: false, error: 'Failed to update room' };
      }

      this.server.to(data.roomId).emit('room-updated', updatedRoom);

      return { success: true };
    } catch (error) {
      console.error('Error in handleTogglePlayerReady:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    try {
      const room = await this.roomService.getRoom(data.roomId);
      if (!room) {
        client.emit('error-message', 'Room not found');
        return;
      }

      const player = room.players.find((p) => p.id === client.id);
      if (!player) {
        client.emit('error-message', 'Player not found4 in room');
        return;
      }

      // ルームからプレイヤーを削除
      const success = await this.roomService.leaveRoom(
        data.roomId,
        player.playerId,
      );

      await this.roomService.updateRoom(data.roomId, room);
      if (!success) {
        client.emit('error-message', 'Failed to leave room');
        return;
      }

      // クライアントをルームから退出
      await client.leave(data.roomId);
      this.playerRooms.delete(client.id);

      // 他のプレイヤーに通知
      this.server.to(data.roomId).emit('player-left', {
        playerId: player.playerId,
        roomId: data.roomId,
      });

      // ルーム一覧を更新
      const rooms = await this.roomService.listRooms();
      this.server.emit('rooms-list', rooms);

      this.server.to(client.id).emit('back-to-lobby');

      this.server.to(room.id).emit('update-players', room.players);

      // プレイヤー数が3人以下ならゲームを一時停止
      const roomGameState = await this.roomService.getRoomGameState(
        data.roomId,
      );
      const state = roomGameState.getState();
      // プレイヤーのチーム情報を保持
      state.teamAssignments[player.playerId] = player.team;
      const actualPlayerCount = room.players.filter(
        (p) => !p.playerId.startsWith('dummy-'),
      ).length;
      if (actualPlayerCount < 4 && state.gamePhase !== null) {
        this.server
          .to(room.id)
          .emit('game-paused', { message: 'Not enough players. Game paused.' });
      }

      return { success: true };
    } catch (error) {
      console.error('Error in handleLeaveRoom:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('change-player-team')
  async handleChangePlayerTeam(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; teamChanges: { [key: string]: number } },
  ): Promise<{ success: boolean }> {
    const { roomId, teamChanges } = data;
    const room = await this.roomService.getRoom(roomId);
    if (!room) {
      client.emit('error-message', 'Room not found');
      return { success: false };
    }

    // ホストのみ許可
    const hostPlayer = room.players.find((p) => p.playerId === room.hostId);
    if (!hostPlayer) {
      client.emit('error-message', 'Only the host can change teams');
      return { success: false };
    }

    // 変更前のチームの人数をカウント
    const currentTeamCounts = {
      0: room.players.filter(
        (p) => !p.playerId.startsWith('dummy-') && p.team === 0,
      ).length,
      1: room.players.filter(
        (p) => !p.playerId.startsWith('dummy-') && p.team === 1,
      ).length,
    };

    // 変更後のチームの人数を計算
    const newTeamCounts = { ...currentTeamCounts };
    for (const [playerId, newTeam] of Object.entries(teamChanges)) {
      const player = room.players.find((p) => p.playerId === playerId);
      if (!player) {
        client.emit('error-message', `Player ${playerId} not found`);
        return { success: false };
      }

      // 現在のチームから移動する場合、そのチームの人数を減らす
      if (player.team === 0) newTeamCounts[0]--;
      if (player.team === 1) newTeamCounts[1]--;

      // 新しいチームの人数を増やす
      newTeamCounts[newTeam as Team]++;
    }

    // 各チームが2人以下であることを確認
    if (newTeamCounts[0] > 2 || newTeamCounts[1] > 2) {
      client.emit('error-message', 'Each team must have at most 2 players');
      return { success: false };
    }

    // すべてのプレイヤーのチームを変更
    for (const [playerId, newTeam] of Object.entries(teamChanges)) {
      const player = room.players.find((p) => p.playerId === playerId);
      if (player) {
        player.team = newTeam as Team;
      }
    }

    room.updatedAt = new Date();
    await this.roomService.updateRoom(roomId, room);
    this.server.to(roomId).emit('room-updated', room);

    return { success: true };
  }
  //-------Room-------

  //-------Game-------
  @SubscribeMessage('start-game')
  async handleStartGame(client: Socket, data: { roomId: string }) {
    const room = await this.roomService.getRoom(data.roomId);
    if (!room) {
      client.emit('error-message', 'Room not found');
      return;
    }

    // Get playerId from game state
    const roomGameState = await this.roomService.getRoomGameState(data.roomId);
    const state = roomGameState.getState();

    const player = state.players.find((p) => p.id === client.id);

    if (!player) {
      client.emit('error-message', 'Player not found5');
      return;
    }

    // ゲーム開始条件チェック
    const { canStart, reason } = await this.roomService.canStartGame(
      data.roomId,
    );
    if (!canStart) {
      client.emit('error-message', reason || 'Cannot start game');
      return;
    }

    try {
      // ルームのステータスを更新
      await this.roomService.updateRoomStatus(data.roomId, RoomStatus.PLAYING);

      // ゲーム開始処理
      roomGameState.startGame();
      const updatedState = roomGameState.getState();

      if (!updatedState) {
        client.emit(
          'error-message',
          'Failed to start game: Invalid game state',
        );
        return;
      }

      // ルームの設定からpointsToWinを取得して設定
      updatedState.pointsToWin = room.settings.pointsToWin;

      // room.playersのhandも更新
      room.players.forEach((roomPlayer) => {
        const statePlayer = updatedState.players.find(
          (p) => p.playerId === roomPlayer.playerId,
        );
        if (statePlayer) {
          roomPlayer.hand = [...statePlayer.hand];
        }
      });

      // Set the first player as the starting player for the first blow phase
      const firstBlowIndex = 0; // First player starts
      const firstBlowPlayer = updatedState.players[firstBlowIndex];

      // Update both currentPlayerIndex and blowState
      updatedState.currentPlayerIndex = firstBlowIndex;
      updatedState.gamePhase = 'blow';
      updatedState.blowState = {
        ...updatedState.blowState,
        currentBlowIndex: firstBlowIndex,
      };

      // ゲーム開始イベントをルームのメンバーにのみ送信
      this.server.to(data.roomId).emit('room-playing', updatedState.players);
      this.server
        .to(data.roomId)
        .emit(
          'game-started',
          data.roomId,
          updatedState.players,
          updatedState.pointsToWin,
        );

      this.server.to(data.roomId).emit('update-phase', {
        phase: 'blow',
        scores: updatedState.teamScores,
        winner: null,
      });

      this.server.to(data.roomId).emit('update-turn', firstBlowPlayer.playerId);

      return { success: true };
    } catch (error) {
      client.emit('error-message', 'Failed to start game: ' + error);
    }
  }

  @SubscribeMessage('declare-blow')
  async handleDeclareBlow(
    client: Socket,
    data: {
      roomId: string;
      declaration: { trumpType: TrumpType; numberOfPairs: number };
    },
  ): Promise<void> {
    const roomGameState = await this.roomService.getRoomGameState(data.roomId);
    const state = roomGameState.getState();
    const player = state.players.find((p) => p.id === client.id);
    if (!player) return;

    if (!roomGameState.isPlayerTurn(player.playerId)) {
      this.server
        .to(data.roomId)
        .emit('error-message', "It's not your turn to declare!");
      return;
    }

    // Validate declaration
    if (
      !this.blowService.isValidDeclaration(
        data.declaration,
        state.blowState.currentHighestDeclaration,
      )
    ) {
      this.server.to(data.roomId).emit('error-message', 'Invalid declaration!');
      return;
    }

    // Add declaration
    const newDeclaration = this.blowService.createDeclaration(
      player.playerId,
      data.declaration.trumpType,
      data.declaration.numberOfPairs,
    );

    state.blowState.declarations.push(newDeclaration);
    state.blowState.currentHighestDeclaration = newDeclaration;

    // Emit update
    this.server.to(data.roomId).emit('blow-updated', {
      declarations: state.blowState.declarations,
      currentHighest: state.blowState.currentHighestDeclaration,
    });

    // Count total actions (declarations + passes)
    const playersWhoHaveActed = new Set<string>();

    // Add players who have declared
    state.blowState.declarations.forEach((declaration) => {
      playersWhoHaveActed.add(declaration.playerId);
    });

    // Add players who have passed
    state.players.forEach((player) => {
      if (player.isPasser) {
        playersWhoHaveActed.add(player.playerId);
      }
    });

    const totalActions = playersWhoHaveActed.size;

    // If all 4 players have acted (either declared or passed), move to play phase
    if (totalActions === 4) {
      await this.handleFourthDeclaration(data.roomId);
    } else {
      roomGameState.nextTurn();
      // Emit turn update to all clients
      const nextPlayer = state.players[state.currentPlayerIndex];
      if (nextPlayer) {
        this.server.to(data.roomId).emit('update-turn', nextPlayer.playerId);
      }
    }
  }

  @SubscribeMessage('pass-blow')
  async handlePassBlow(
    client: Socket,
    data: { roomId: string },
  ): Promise<void> {
    const roomGameState = await this.roomService.getRoomGameState(data.roomId);
    const state = roomGameState.getState();
    const player = state.players.find((p) => p.id === client.id);
    if (!player) return;

    // First check if it's the player's turn
    if (!roomGameState.isPlayerTurn(player.playerId)) {
      client.emit('error-message', "It's not your turn to pass!1");
      return;
    }

    // Mark player as passed
    player.isPasser = true;
    state.blowState.lastPasser = player.playerId;

    // Emit update
    this.server.to(data.roomId).emit('blow-updated', {
      declarations: state.blowState.declarations,
      currentHighest: state.blowState.currentHighestDeclaration,
      lastPasser: player.playerId,
    });

    // Count total actions (declarations + passes)
    const playersWhoHaveActed = new Set<string>();

    // Add players who have declared
    state.blowState.declarations.forEach((declaration) => {
      playersWhoHaveActed.add(declaration.playerId);
    });

    // Add players who have passed
    state.players.forEach((player) => {
      if (player.isPasser) {
        playersWhoHaveActed.add(player.playerId);
      }
    });

    const totalActions = playersWhoHaveActed.size;

    // If all 4 players have acted (either declared or passed), move to play phase
    if (totalActions === 4) {
      // If no one has declared, start a new round
      if (state.blowState.declarations.length === 0) {
        // Reset player pass states
        state.players.forEach((p) => (p.isPasser = false));
        state.blowState.lastPasser = null;
        state.blowState.declarations = [];
        state.blowState.currentHighestDeclaration = null;
        state.blowState.currentBlowIndex =
          (state.blowState.currentBlowIndex + 1) % state.players.length;

        // Move to next dealer and restart blow phase
        roomGameState.nextTurn();
        const nextDealerIndex = state.currentPlayerIndex;
        const firstBlowIndex = (nextDealerIndex + 1) % state.players.length;
        const firstBlowPlayer = state.players[firstBlowIndex];

        if (!firstBlowPlayer) return;

        state.currentPlayerIndex = firstBlowIndex;

        // Regenerate deck and deal cards
        state.deck = this.cardService.generateDeck();
        roomGameState.dealCards();

        // Emit round cancelled
        this.server.to(data.roomId).emit('round-cancelled', {
          nextDealer: firstBlowPlayer.playerId,
          players: state.players,
        });

        // Emit turn update
        this.server
          .to(data.roomId)
          .emit('update-turn', firstBlowPlayer.playerId);
        return;
      }

      await this.handleFourthDeclaration(data.roomId);
      return;
    }

    // Move to next player
    roomGameState.nextTurn();
    // Skip passed players
    while (state.players[state.currentPlayerIndex].isPasser) {
      roomGameState.nextTurn();
    }
    // Emit turn update
    const nextPlayer = state.players[state.currentPlayerIndex];
    if (nextPlayer) {
      this.server.to(data.roomId).emit('update-turn', nextPlayer.playerId);
    }
  }

  private async handleFourthDeclaration(roomId: string): Promise<void> {
    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();
    const winner = this.blowService.findHighestDeclaration(
      state.blowState.declarations,
    );
    const winningPlayer = state.players.find(
      (p) => p.playerId === winner.playerId,
    );
    if (!winningPlayer) {
      return;
    }

    // 状態の更新を先に行う
    if (state.agari) {
      winningPlayer.hand.push(state.agari);
    }
    winningPlayer.hand.sort((a, b) => this.cardService.compareCards(a, b));
    // ジャックが4枚あるか確認
    this.chomboService.checkForRequiredBrokenHand(winningPlayer);

    // 強制ブロークン状態の場合の処理
    if (winningPlayer.hasRequiredBroken) {
      const client = this.server.sockets.sockets.get(winningPlayer.id);
      if (client) {
        await this.handleRevealBrokenHand(client, {
          roomId: roomId,
          playerId: winningPlayer.playerId,
        });
      } else {
        console.error(`Socket not found for player: ${winningPlayer.playerId}`);
      }
    }

    state.gamePhase = 'play';
    state.blowState.currentTrump = winner.trumpType;
    const winnerIndex = state.players.findIndex(
      (p) => p.playerId === winner.playerId,
    );
    if (winnerIndex !== -1) {
      state.currentPlayerIndex = winnerIndex;
    }

    // プレイヤー情報の更新を即時送信
    this.server.to(roomId).emit('update-players', state.players);

    // 3秒後に残りのイベントを送信
    setTimeout(() => {
      // アガリカードを勝者に通知
      this.server.to(winningPlayer.id).emit('reveal-agari', {
        agari: state.agari,
        message: 'Select a card from your hand as Negri',
        playerId: winningPlayer.playerId,
      });

      // 最新の状態を取得してからイベントを送信
      const currentState = roomGameState.getState();

      // まずターン更新を送信
      this.server.to(roomId).emit('update-turn', winningPlayer.playerId);

      // その後にフェーズ更新を送信
      this.server.to(roomId).emit('update-phase', {
        phase: 'play',
        scores: currentState.teamScores,
        winner: winningPlayer.team,
        currentHighestDeclaration:
          currentState.blowState.currentHighestDeclaration,
      });
    }, 3000);
  }

  @SubscribeMessage('select-negri')
  async handleSelectNegri(
    client: Socket,
    data: { roomId: string; card: string },
  ): Promise<void> {
    const roomGameState = await this.roomService.getRoomGameState(data.roomId);
    const state = roomGameState.getState();
    const player = state.players.find((p) => p.id === client.id);

    if (!player) return;
    if (state.gamePhase !== 'play') {
      client.emit('error-message', 'Cannot select Negri card now!');
      return;
    }
    if (!roomGameState.isPlayerTurn(player.playerId)) {
      client.emit('error-message', "It's not your turn to select Negri!");
      return;
    }

    // Validate the card is in player's hand
    if (!player.hand.includes(data.card)) {
      client.emit('error-message', 'Selected card is not in your hand!');
      return;
    }

    // Set up play state
    state.playState = {
      currentField: {
        cards: [],
        baseCard: '',
        dealerId: player.playerId,
        isComplete: false,
      },
      negriCard: data.card,
      neguri: {},
      fields: [],
      lastWinnerId: null,
      openDeclared: false,
      openDeclarerId: null,
    };

    // Remove Negri card from hand
    player.hand = player.hand.filter((c) => c !== data.card);

    // Get the winner of the declaration
    const winner = this.blowService.findHighestDeclaration(
      state.blowState.declarations,
    );
    if (!winner) return;

    // Set the winner as the first player to play
    const winnerIndex = state.players.findIndex(
      (p) => p.playerId === winner.playerId,
    );
    if (winnerIndex === -1) return;

    state.currentPlayerIndex = winnerIndex;

    this.server.to(data.roomId).emit('update-players', state.players);

    // Emit updates
    this.server.to(data.roomId).emit('play-setup-complete', {
      negriCard: data.card,
      startingPlayer: state.players[winnerIndex].playerId,
    });
    this.server
      .to(data.roomId)
      .emit('update-turn', state.players[winnerIndex].playerId);
  }

  @SubscribeMessage('play-card')
  async handlePlayCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; card: string },
  ): Promise<void> {
    const roomGameState = await this.roomService.getRoomGameState(data.roomId);
    const state = roomGameState.getState();
    const player = state.players.find((p) => p.id === client.id);
    if (!player) {
      return;
    }
    if (!player.hand.includes(data.card)) {
      console.warn(
        `[WARN] ${player.name} tried to play a card (${data.card}) not in hand`,
      );
      client.emit('error-message', 'Card already played or invalid!');
      return;
    }

    // Check if currentField exists
    if (!state.playState?.currentField) {
      console.error('No current field found in game state');
      client.emit('error-message', 'Game state error: No current field');
      return;
    }

    // Check if it's the player's turn
    if (!roomGameState.isPlayerTurn(player.playerId)) {
      client.emit('error-message', "It's not your turn to play!");
      return;
    }

    if (state.playState.currentField.cards.includes(data.card)) {
      console.warn(
        `[WARN] ${player.name} tried to play a duplicate card (${data.card})`,
      );
      client.emit('error-message', 'Card already played on the field!');
      return;
    }

    // Remove the card from player's hand first
    player.hand = player.hand.filter((c) => c !== data.card);

    // Then play the card to the field
    const currentField = state.playState.currentField;
    currentField.cards.push(data.card);
    if (currentField.cards.length === 1) {
      currentField.baseCard = data.card;
    }

    // Emit the card played event with updated players
    this.server.to(data.roomId).emit('card-played', {
      playerId: player.playerId,
      card: data.card,
      field: currentField,
      players: state.players,
    });

    // Check if field is complete
    if (currentField.cards.length === 4) {
      setTimeout(() => {
        void this.handleFieldComplete(currentField, data.roomId);
      }, 3000);
    } else {
      // If Joker is baseCard and currentTrump is 'tra' and baseSuit is not selected, don't proceed to next turn
      if (currentField.baseCard === 'JOKER' && !currentField.baseSuit) {
        return;
      }

      roomGameState.nextTurn();
      // Emit turn update
      const nextPlayer = state.players[state.currentPlayerIndex];
      if (nextPlayer) {
        this.server.to(data.roomId).emit('update-turn', nextPlayer.playerId);
      }
    }
  }

  private async handleFieldComplete(
    field: Field,
    roomId: string,
  ): Promise<void> {
    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();

    const winner = this.playService.determineFieldWinner(
      field,
      state.players,
      state.blowState.currentTrump,
    );

    if (!winner) {
      console.error('No winner determined for field:', field);
      return;
    }

    field.cards.forEach((card) => {
      state.players.forEach((player) => {
        player.hand = player.hand.filter((c) => c !== card);
      });
    });

    // Add the completed field to history
    const completedField = roomGameState.completeField(field, winner.playerId);
    if (!completedField) {
      console.error('Failed to complete field:', field);
      return;
    }

    // Check if all players have empty hands (round end)
    const allHandsEmpty = state.players.every(
      (player) => player.hand.length === 0,
    );

    // Set the winner as the next dealer
    const winnerIndex = state.players.findIndex(
      (p) => p.playerId === winner.playerId,
    );
    if (winnerIndex !== -1) {
      state.currentPlayerIndex = winnerIndex;
    }

    // Create a new field with the winner as the dealer
    if (state.playState) {
      state.playState.currentField = {
        cards: [],
        baseCard: '',
        dealerId: winner.playerId,
        isComplete: false,
      };
    }

    // Emit field complete event with winner information
    this.server.to(roomId).emit('field-complete', {
      winnerId: winner.playerId,
      field: completedField,
      nextPlayerId: winner.playerId,
    });

    // Update all clients with the latest player states
    this.server.to(roomId).emit('update-players', state.players);

    if (allHandsEmpty) {
      // Handle game over after ensuring all updates are sent
      setTimeout(() => {
        void this.handleGameOver(roomId);
      }, 1000);
      return;
    }

    // Emit turn update to indicate it's the winner's turn
    this.server.to(roomId).emit('update-turn', winner.playerId);
  }

  private async handleGameOver(roomId: string): Promise<void> {
    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();

    if (!state.blowState.currentHighestDeclaration) {
      console.error('No highest declaration found');
      return;
    }

    // まず現在のプレイヤーからチームを探す
    let declaringTeam = state.players.find(
      (p) => p.playerId === state.blowState.currentHighestDeclaration?.playerId,
    )?.team;

    console.log('state', state);

    // 現在のプレイヤーに見つからない場合は、teamAssignmentsから探す
    if (declaringTeam == null && state.teamAssignments) {
      declaringTeam =
        state.teamAssignments[
          state.blowState.currentHighestDeclaration.playerId
        ];
    }

    if (declaringTeam == null) {
      console.error(
        'No declaring team found for player:',
        state.blowState.currentHighestDeclaration.playerId,
      );
      return;
    }

    const playPoints = this.scoreService.calculatePlayPoints(
      state.blowState.currentHighestDeclaration?.numberOfPairs || 0,
      state.playState?.fields.filter((f) => f.winnerTeam === declaringTeam)
        .length || 0,
    );

    // Update team scores
    if (playPoints > 0) {
      state.teamScores[declaringTeam].play += playPoints;
      state.teamScores[declaringTeam].total += playPoints;
      state.teamScoreRecords[declaringTeam] = [
        ...state.teamScoreRecords[declaringTeam],
        {
          points: playPoints,
          timestamp: new Date(),
          reason: 'Play points',
        },
      ];
    } else {
      const opposingTeam = (1 - declaringTeam) as Team;
      state.teamScores[opposingTeam].play += Math.abs(playPoints);
      state.teamScores[opposingTeam].total += Math.abs(playPoints);
      state.teamScoreRecords[opposingTeam] = [
        ...state.teamScoreRecords[opposingTeam],
        {
          points: Math.abs(playPoints),
          timestamp: new Date(),
          reason: 'Play points',
        },
      ];
    }

    // Check if any team has reached pointsToWin
    const hasTeamReached = Object.values(state.teamScores).some(
      (score) => score.total >= state.pointsToWin,
    );

    if (hasTeamReached) {
      // Find the winning team
      const winningTeamEntry = Object.entries(state.teamScores).find(
        ([, score]) => score.total >= state.pointsToWin,
      );
      const finalWinningTeam = winningTeamEntry
        ? (Number(winningTeamEntry[0]) as Team)
        : declaringTeam;

      // Emit final game over event
      this.server.to(roomId).emit('game-over', {
        winner: `Team ${finalWinningTeam}`,
        finalScores: state.teamScores,
      });

      await this.roomService.updateRoomStatus(roomId, RoomStatus.FINISHED);

      // Reset game state after a delay
      setTimeout(() => {
        roomGameState.resetState();
      }, 5000);
    } else {
      // Emit round results and start new round
      this.server.to(roomId).emit('round-results', {
        scores: state.teamScores,
      });

      // Start new round after a short delay
      setTimeout(() => {
        roomGameState.resetRoundState();
        roomGameState.roundNumber++;

        // Emit round reset event
        this.server.to(roomId).emit('round-reset');

        // Get fresh state after reset
        const updatedState = roomGameState.getState();

        const nextBlowIndex =
          (state.blowState.currentBlowIndex + 1) % state.players.length;
        const nextBlowPlayer = state.players[nextBlowIndex];

        // 通常のゲーム初期化
        updatedState.gamePhase = 'blow';
        updatedState.deck = this.cardService.generateDeck();
        roomGameState.dealCards();

        // プレイ状態を設定
        updatedState.playState = {
          currentField: {
            cards: [],
            baseCard: '',
            dealerId: nextBlowPlayer.playerId,
            isComplete: false,
          },
          negriCard: null,
          neguri: {},
          fields: [],
          lastWinnerId: null,
          openDeclared: false,
          openDeclarerId: null,
        };

        // ブロー状態を設定
        updatedState.blowState = {
          currentTrump: null,
          currentHighestDeclaration: null,
          declarations: [],
          lastPasser: null,
          isRoundCancelled: false,
          currentBlowIndex: nextBlowIndex,
        };

        // Update game state with the new state
        roomGameState.updateState({
          gamePhase: updatedState.gamePhase,
          players: updatedState.players,
          playState: updatedState.playState,
          blowState: updatedState.blowState,
        });

        this.server.to(roomId).emit('update-players', updatedState.players);

        // Emit new round started event with all necessary state
        this.server.to(roomId).emit('new-round-started', {
          players: updatedState.players,
          currentTurn: nextBlowPlayer.playerId,
          gamePhase: 'blow',
          currentField: null,
          completedFields: [],
          negriCard: null,
          negriPlayerId: null,
          revealedAgari: null,
          currentTrump: null,
          currentHighestDeclaration: null,
          blowDeclarations: [],
        });

        // Update turn
        roomGameState.currentTurn = nextBlowPlayer.playerId;
        this.server.to(roomId).emit('update-turn', nextBlowPlayer.playerId);

        // Emit phase update with current trump
        this.server.to(roomId).emit('update-phase', {
          phase: 'blow',
          scores: updatedState.teamScores,
          winner: nextBlowPlayer.team,
          currentTrump: null,
        });
      }, 3000);
    }
  }

  @SubscribeMessage('select-base-suit')
  async handleSelectBaseSuit(
    client: Socket,
    data: { roomId: string; suit: string },
  ): Promise<void> {
    const roomGameState = await this.roomService.getRoomGameState(data.roomId);
    const state = roomGameState.getState();
    if (
      !state.playState?.currentField ||
      state.playState.currentField.baseCard !== 'JOKER'
    ) {
      client.emit('error-message', 'Cannot select base suit now!');
      return;
    }

    const player = state.players.find((p) => p.id === client.id);
    if (!player) return;

    if (state.playState.currentField.dealerId !== player.playerId) {
      client.emit('error-message', "It's not your turn to select base suit!");
      return;
    }

    state.playState.currentField.baseSuit = data.suit;
    this.server
      .to(data.roomId)
      .emit('field-updated', state.playState.currentField);

    // Proceed to next turn after base suit selection
    roomGameState.nextTurn();
    const nextPlayer = state.players[state.currentPlayerIndex];
    if (nextPlayer) {
      this.server.to(data.roomId).emit('update-turn', nextPlayer.playerId);
    }
  }

  @SubscribeMessage('reveal-broken-hand')
  async handleRevealBrokenHand(
    client: Socket,
    data: { roomId: string; playerId: string },
  ): Promise<void> {
    const roomGameState = await this.roomService.getRoomGameState(data.roomId);
    const state = roomGameState.getState();
    const player = state.players.find((p) => p.playerId === data.playerId);

    if (!player) return;

    // TODO: 実装：全員に手札を公開
    // this.server.emit('reveal-hands', {
    //   players: state.players.map((p) => ({
    //     playerId: p.playerId,
    //     hand: p.hand,
    //   })),
    // });

    // 3秒後に次のターンに進む
    setTimeout(() => {
      // Reset player pass states
      state.blowState.declarations = [];
      state.blowState.currentHighestDeclaration = null;

      // Move to next dealer and restart blow phase
      const firstBlowIndex = state.blowState.currentBlowIndex;
      const firstBlowPlayer = state.players[firstBlowIndex];

      state.currentPlayerIndex = firstBlowIndex;

      // Regenerate deck and deal cards
      state.deck = this.cardService.generateDeck();
      this.gameState.dealCards();

      // Emit round cancelled
      this.server.emit('broken', {
        nextPlayerId: firstBlowPlayer.playerId,
        players: state.players,
      });

      // Emit turn update
      this.server.emit('update-turn', firstBlowPlayer.playerId);
      return;
    }, 3000); // 3秒間待機
  }
  //-------Game-------
}
