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
import { ChomboService } from './services/chombo.service';
import { BlowService } from './services/blow.service';
import { PlayService } from './services/play.service';
import { TrumpType } from './types/game.types';
import { ChomboViolation } from './types/game.types';
import { Field } from './types/game.types';
import { ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Team } from './types/game.types';

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly gameState: GameStateService,
    private readonly cardService: CardService,
    private readonly scoreService: ScoreService,
    private readonly chomboService: ChomboService,
    private readonly blowService: BlowService,
    private readonly playService: PlayService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Player connected: ${client.id}`);
    const state = this.gameState.getState();
    this.server.emit('update-players', state.players);
  }

  handleDisconnect(client: Socket) {
    this.gameState.removePlayer(client.id);
    const state = this.gameState.getState();
    this.server.emit('update-players', state.players);
    console.log(`Player disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-game')
  handleJoinGame(client: Socket, name: string) {
    const success = this.gameState.addPlayer(client.id, name);
    if (!success) {
      client.emit('error-message', 'Game is full!');
      return;
    }
    const state = this.gameState.getState();
    this.server.emit('update-players', state.players);
  }

  @SubscribeMessage('start-game')
  handleStartGame(client: Socket): void {
    console.log('Game starting...');
    const state = this.gameState.getState();

    if (state.players.length !== 4) {
      console.log('Need exactly 4 players to start the game.');
      client.emit('error-message', 'Need exactly 4 players to start the game.');
      return;
    }

    // 通常のゲーム初期化
    state.gamePhase = 'blow';
    state.deck = this.cardService.generateDeck();
    this.gameState.dealCards();

    // プレイ状態を設定
    state.playState = {
      currentField: {
        cards: [],
        baseCard: '',
        dealerId: state.players[0].id,
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

    // ブロー状態を設定
    state.blowState = {
      currentTrump: null,
      currentHighestDeclaration: null,
      declarations: [],
      lastPasser: null,
      isRoundCancelled: false,
      startingPlayerId: state.players[0].id,
      currentBlowIndex: 0,
    };

    // 初期状態をクライアントに通知
    this.server.emit('game-started', state.players);
    this.server.emit('update-phase', {
      phase: 'blow',
      scores: state.teamScores,
      winner: null,
    });
    this.server.emit('update-players', state.players);
    this.server.emit('update-turn', state.players[0].id);
  }

  @SubscribeMessage('declare-blow')
  handleDeclareBlow(
    client: Socket,
    declaration: { trumpType: TrumpType; numberOfPairs: number },
  ) {
    if (!this.gameState.isPlayerTurn(client.id)) {
      client.emit('error-message', "It's not your turn to declare!");
      return;
    }

    const state = this.gameState.getState();
    const player = state.players.find((p) => p.id === client.id);
    if (!player) return;

    // Validate declaration
    if (
      !this.blowService.isValidDeclaration(
        declaration,
        state.blowState.currentHighestDeclaration,
      )
    ) {
      client.emit('error-message', 'Invalid declaration!');
      return;
    }

    // Add declaration
    const newDeclaration = this.blowService.createDeclaration(
      client.id,
      declaration.trumpType,
      declaration.numberOfPairs,
    );

    state.blowState.declarations.push(newDeclaration);
    state.blowState.currentHighestDeclaration = newDeclaration;

    // Emit update
    this.server.emit('blow-updated', {
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
        playersWhoHaveActed.add(player.id);
      }
    });

    const totalActions = playersWhoHaveActed.size;
    console.log('Players who have acted:', Array.from(playersWhoHaveActed));
    console.log('Total actions:', totalActions);

    // If all 4 players have acted (either declared or passed), move to play phase
    if (totalActions === 4) {
      console.log('All players have acted');
      this.handleFourthDeclaration();
    } else {
      console.log('Next turn');
      this.gameState.nextTurn();
      // Emit turn update to all clients
      const nextPlayer = state.players[state.currentPlayerIndex];
      if (nextPlayer) {
        this.server.emit('update-turn', nextPlayer.id);
      }
    }
  }

  @SubscribeMessage('pass-blow')
  handlePassBlow(client: Socket): void {
    // First check if it's the player's turn
    if (!this.gameState.isPlayerTurn(client.id)) {
      client.emit('error-message', "It's not your turn to pass!");
      return;
    }

    const state = this.gameState.getState();
    const player = state.players.find((p) => p.id === client.id);
    if (!player) return;

    // Mark player as passed
    player.isPasser = true;
    state.blowState.lastPasser = client.id;

    // Emit update
    this.server.emit('blow-updated', {
      declarations: state.blowState.declarations,
      currentHighest: state.blowState.currentHighestDeclaration,
      lastPasser: client.id,
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
        playersWhoHaveActed.add(player.id);
      }
    });

    const totalActions = playersWhoHaveActed.size;
    console.log('Players who have acted:', Array.from(playersWhoHaveActed));
    console.log('Total actions:', totalActions);

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
        this.gameState.nextTurn();
        const nextDealerIndex = state.currentPlayerIndex;
        const firstBlowIndex = (nextDealerIndex + 1) % state.players.length;
        const firstBlowPlayer = state.players[firstBlowIndex];

        if (!firstBlowPlayer) return;

        state.currentPlayerIndex = firstBlowIndex;
        state.blowState.startingPlayerId = firstBlowPlayer.id;

        // Emit round cancelled
        this.server.emit('round-cancelled', {
          nextDealer: state.players[nextDealerIndex].id,
          players: state.players,
        });

        // Emit turn update
        this.server.emit('update-turn', firstBlowPlayer.id);
        return;
      }

      const winner = state.blowState.currentHighestDeclaration;
      if (!winner) return;

      const winningPlayer = state.players.find((p) => p.id === winner.playerId);
      if (!winningPlayer) return;

      // Move to play phase
      state.gamePhase = 'play';
      state.blowState.currentTrump = winner.trumpType;

      // Emit updates
      this.server.emit('update-phase', {
        phase: 'play',
        scores: state.teamScores,
        winner: winningPlayer.team,
      });

      // Call handleFourthDeclaration to handle the transition to play phase
      this.handleFourthDeclaration();
      return;
    }

    // Move to next player
    this.gameState.nextTurn();
    // Skip passed players
    while (state.players[state.currentPlayerIndex].isPasser) {
      this.gameState.nextTurn();
    }
    // Emit turn update
    const nextPlayer = state.players[state.currentPlayerIndex];
    if (nextPlayer) {
      this.server.emit('update-turn', nextPlayer.id);
    }
  }

  private handleFourthDeclaration(): void {
    console.log('handleFourthDeclaration called');
    const state = this.gameState.getState();
    const winner = this.blowService.findHighestDeclaration(
      state.blowState.declarations,
    );
    const winningPlayer = state.players.find((p) => p.id === winner.playerId);
    if (!winningPlayer) {
      console.log('No winning player found');
      return;
    }
    console.log('Winner found:', winningPlayer.id);
    console.log("Winner's hand before adding Agari:", winningPlayer.hand);

    // Add Agari card to winner's hand first
    if (state.agari) {
      winningPlayer.hand.push(state.agari);
      console.log("Added Agari card to winner's hand:", state.agari);
      console.log("Winner's hand after adding Agari:", winningPlayer.hand);
    }

    // Move to play phase
    state.gamePhase = 'play';
    state.blowState.currentTrump = winner.trumpType;

    // Set current player to the winner for Negri selection
    const winnerIndex = state.players.findIndex(
      (p) => p.id === winner.playerId,
    );
    if (winnerIndex !== -1) {
      state.currentPlayerIndex = winnerIndex;
    }

    // First update all players about the new state with the Agari card added
    console.log('Emitting update-players with updated hand');
    this.server.emit('update-players', state.players);

    // Then emit Agari card to winner
    console.log('Emitting reveal-agari to winner:', winningPlayer.id);
    this.server.to(winningPlayer.id).emit('reveal-agari', {
      agari: state.agari,
      message: 'Select a card from your hand as Negri',
    });

    // Finally emit phase update and turn update
    this.server.emit('update-phase', {
      phase: 'play',
      scores: state.teamScores,
      winner: winningPlayer.team,
    });
    this.server.emit('update-turn', winningPlayer.id);
  }

  @SubscribeMessage('select-negri')
  handleSelectNegri(client: Socket, card: string): void {
    const state = this.gameState.getState();
    const player = state.players.find((p) => p.id === client.id);

    if (!player) return;
    if (state.gamePhase !== 'play') {
      client.emit('error-message', 'Cannot select Negri card now!');
      return;
    }
    if (!this.gameState.isPlayerTurn(client.id)) {
      client.emit('error-message', "It's not your turn to select Negri!");
      return;
    }

    // Validate the card is in player's hand
    if (!player.hand.includes(card)) {
      client.emit('error-message', 'Selected card is not in your hand!');
      return;
    }

    // Set up play state
    state.playState = {
      currentField: {
        cards: [],
        baseCard: '',
        dealerId: client.id,
        isComplete: false,
      },
      negriCard: card,
      neguri: {},
      fields: [],
      lastWinnerId: null,
      isTanzenRound: false,
      openDeclared: false,
      openDeclarerId: null,
    };

    // Remove Negri card from hand
    player.hand = player.hand.filter((c) => c !== card);

    // Get the winner of the declaration
    const winner = this.blowService.findHighestDeclaration(
      state.blowState.declarations,
    );
    if (!winner) return;

    // Set the winner as the first player to play
    const winnerIndex = state.players.findIndex(
      (p) => p.id === winner.playerId,
    );
    if (winnerIndex === -1) return;

    state.currentPlayerIndex = winnerIndex;

    this.server.emit('update-players', state.players);

    // Emit updates
    this.server.emit('play-setup-complete', {
      negriCard: card,
      startingPlayer: state.players[winnerIndex].id,
    });
    this.server.emit('update-turn', state.players[winnerIndex].id);
  }

  @SubscribeMessage('play-card')
  handlePlayCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() card: string,
  ): void {
    const state = this.gameState.getState();
    const player = state.players.find((p) => p.id === client.id);
    if (!player) {
      console.log('Player not found for client:', client.id);
      return;
    }

    // Check if currentField exists
    if (!state.playState.currentField) {
      console.error('No current field found in game state');
      client.emit('error-message', 'Game state error: No current field');
      return;
    }

    // Validate the card play
    if (
      !this.playService.isValidCardPlay(
        player.hand,
        card,
        state.playState.currentField,
        state.blowState.currentTrump,
        state.playState.isTanzenRound,
      )
    ) {
      console.log('Invalid card play:', { playerId: player.id, card });
      client.emit('error-message', 'Invalid card play');
      return;
    }

    // Remove the card from player's hand first
    player.hand = player.hand.filter((c) => c !== card);

    // Then play the card to the field
    const currentField = state.playState.currentField;
    currentField.cards.push(card);
    if (currentField.cards.length === 1) {
      currentField.baseCard = card;
    }

    // Emit the card played event with updated players
    this.server.emit('card-played', {
      playerId: player.id,
      card,
      field: currentField,
      players: state.players,
    });

    // Check if field is complete
    if (currentField.cards.length === 4) {
      this.handleFieldComplete(currentField);
    } else {
      this.gameState.nextTurn();
      // Emit turn update
      const nextPlayer = state.players[state.currentPlayerIndex];
      if (nextPlayer) {
        this.server.emit('update-turn', nextPlayer.id);
      }
    }
  }

  private handleFieldComplete(field: Field) {
    const state = this.gameState.getState();
    console.log('state.blowState.currentTrump', state.blowState.currentTrump);
    const winner = this.playService.determineFieldWinner(
      field,
      state.players,
      state.blowState.currentTrump,
    );

    if (!winner) {
      console.error('No winner determined for field:', field);
      return;
    }

    // Remove played cards from players' hands
    field.cards.forEach((card) => {
      state.players.forEach((player) => {
        player.hand = player.hand.filter((c) => c !== card);
      });
    });

    // Add the completed field to history
    const completedField = this.gameState.completeField(field, winner.id);
    if (!completedField) {
      console.error('Failed to complete field:', field);
      return;
    }

    // Check if all players have empty hands (round end)
    const allHandsEmpty = state.players.every(
      (player) => player.hand.length === 0,
    );
    if (allHandsEmpty) {
      // Determine winning team based on fields won
      const winningTeam = this.playService.determineWinningTeam(
        state.playState.fields,
        state.players,
      );
      console.log('handleGameOverwinningTeam', winningTeam);
      this.handleGameOver(winningTeam as Team);
      return;
    }

    // Set the winner as the next dealer
    const winnerIndex = state.players.findIndex((p) => p.id === winner.id);
    if (winnerIndex !== -1) {
      state.currentPlayerIndex = winnerIndex;
    }

    // Create a new field with the winner as the dealer
    state.playState.currentField = {
      cards: [],
      baseCard: '',
      dealerId: winner.id,
      isComplete: false,
    };

    // Emit field complete event with winner information
    this.server.emit('field-complete', {
      winnerId: winner.id,
      field: completedField,
      nextPlayerId: winner.id,
    });

    // Emit turn update to indicate it's the winner's turn
    this.server.emit('update-turn', winner.id);
  }

  private handleGameOver(winnerTeam: Team) {
    const state = this.gameState.getState();
    const playPoints = this.scoreService.calculatePlayPoints(
      state.playState.fields.filter(
        (f) =>
          state.players.find((p) => p.id === f.dealerId)?.team === winnerTeam,
      ).length,
      state.blowState.currentHighestDeclaration?.numberOfPairs || 0,
    );

    // Update team scores
    if (playPoints > 0) {
      state.teamScores[winnerTeam].play += playPoints;
      state.teamScores[winnerTeam].total += playPoints;
      state.teamScoreRecords[winnerTeam] = this.scoreService.updateTeamScore(
        winnerTeam,
        playPoints,
        state.teamScoreRecords[winnerTeam],
      );
    } else {
      const opposingTeam = winnerTeam === 0 ? 1 : 0;
      state.teamScores[opposingTeam].play += Math.abs(playPoints);
      state.teamScores[opposingTeam].total += Math.abs(playPoints);
      state.teamScoreRecords[opposingTeam] = this.scoreService.updateTeamScore(
        opposingTeam,
        Math.abs(playPoints),
        state.teamScoreRecords[opposingTeam],
      );
    }

    // Check if any team has reached 17 points
    const hasTeamReached = Object.values(state.teamScores).some(
      (score) => score.total >= 5,
      // (score) => score.total >= 17,
    );

    if (hasTeamReached) {
      // Find the winning team
      const winningTeamEntry = Object.entries(state.teamScores).find(
        // TODO: テストのため5
        ([, score]) => score.total >= 5,
      );
      const finalWinningTeam = winningTeamEntry
        ? (Number(winningTeamEntry[0]) as Team)
        : winnerTeam;

      // Emit final game over event
      this.server.emit('game-over', {
        winner: `Team ${finalWinningTeam}`,
        finalScores: state.teamScores,
      });

      // Reset game state after a delay
      setTimeout(() => {
        this.gameState.resetState();
      }, 5000);
    } else {
      // Emit round results and start new round
      this.server.emit('round-results', {
        roundNumber: this.gameState.roundNumber,
        scores: state.teamScores,
        scoreRecords: state.teamScoreRecords,
      });

      // Start new round after a short delay
      setTimeout(() => {
        // Store previous dealer index before reset
        const prevDealerId = state.playState?.currentField?.dealerId;
        const prevDealerIndex = prevDealerId
          ? state.players.findIndex((p) => p.id === prevDealerId)
          : 0;

        this.gameState.resetRoundState();
        this.gameState.roundNumber++;

        // Emit round reset event
        this.server.emit('round-reset');

        // Get fresh state after reset
        const updatedState = this.gameState.getState();

        // Calculate next dealer
        const nextDealerIndex =
          (prevDealerIndex + 1) % updatedState.players.length;
        const nextDealer = updatedState.players[nextDealerIndex];

        // 通常のゲーム初期化
        updatedState.gamePhase = 'blow';
        updatedState.deck = this.cardService.generateDeck();
        this.gameState.dealCards();

        // プレイ状態を設定
        updatedState.playState = {
          currentField: {
            cards: [],
            baseCard: '',
            dealerId: nextDealer.id,
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

        // ブロー状態を設定
        updatedState.blowState = {
          currentTrump: null,
          currentHighestDeclaration: null,
          declarations: [],
          lastPasser: null,
          isRoundCancelled: false,
          startingPlayerId: nextDealer.id,
          currentBlowIndex: state.blowState.currentBlowIndex,
        };

        // Update game state with the new state
        this.gameState.updateState({
          gamePhase: updatedState.gamePhase,
          players: updatedState.players,
          playState: updatedState.playState,
          blowState: updatedState.blowState,
        });

        // Always emit update-players event to update player hands
        console.log(
          'Emitting update-players event with players:',
          updatedState.players,
        );
        this.server.emit('update-players', updatedState.players);
        console.log('update-players event emitted');

        // Emit new round started event with all necessary state
        this.server.emit('new-round-started', {
          players: updatedState.players,
          currentTurn: nextDealer.id,
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
        this.gameState.currentTurn = nextDealer.id;
        this.server.emit('update-turn', nextDealer.id);

        // Emit phase update with current trump
        this.server.emit('update-phase', {
          phase: 'blow',
          scores: updatedState.teamScores,
          winner: nextDealer.team,
          currentTrump: null,
        });
      }, 3000);
    }
  }

  @SubscribeMessage('report-chombo')
  handleReportChombo(
    client: Socket,
    {
      playerId,
      violationType,
    }: { playerId: string; violationType: ChomboViolation['type'] },
  ) {
    const state = this.gameState.getState();
    const reporter = state.players.find((p) => p.id === client.id);
    const violator = state.players.find((p) => p.id === playerId);

    if (!reporter || !violator) {
      client.emit('error-message', 'Invalid player!');
      return;
    }

    const violation = this.chomboService.reportViolation(
      client.id,
      playerId,
      violationType,
      reporter.team,
      violator.team,
    );

    if (!violation) {
      client.emit(
        'error-message',
        'No valid violation found or cannot report own team!',
      );
      return;
    }

    // Award 5 points to the reporting team
    state.teamScores[reporter.team].play += 5;
    state.teamScores[reporter.team].total += 5;
    state.teamScoreRecords[reporter.team] = this.scoreService.updateTeamScore(
      reporter.team,
      5,
      state.teamScoreRecords[reporter.team],
    );

    // Emit chombo reported
    this.server.emit('chombo-reported', {
      reporter: client.id,
      violator: playerId,
      violationType,
      reportingTeam: reporter.team,
      updatedScores: state.teamScores,
      scoreRecords: state.teamScoreRecords,
    });

    // End the round
    this.handleRoundEnd();
  }

  private handleRoundEnd(): void {
    const state = this.gameState.getState();
    this.chomboService.expireViolations();

    // Emit round end
    this.server.emit('round-ended', {
      players: state.players,
      scores: state.teamScores,
      scoreRecords: state.teamScoreRecords,
    });
  }

  @SubscribeMessage('start-blow')
  handleStartBlow(client: Socket): void {
    const state = this.gameState.getState();
    if (state.gamePhase !== 'deal') {
      client.emit('error-message', 'Cannot start blow phase now!');
      return;
    }

    // The first player to blow should be the player to the left of the dealer
    const dealerIndex = state.currentPlayerIndex;
    const firstBlowIndex =
      (dealerIndex + state.blowState.currentBlowIndex) % state.players.length;
    const firstBlowPlayer = state.players[firstBlowIndex];

    if (!firstBlowPlayer) {
      client.emit('error-message', 'Cannot determine first player to blow!');
      return;
    }

    // Update game phase and state
    state.gamePhase = 'blow';
    state.currentPlayerIndex = firstBlowIndex;
    state.blowState = {
      currentTrump: null,
      currentHighestDeclaration: null,
      declarations: [],
      lastPasser: null,
      isRoundCancelled: false,
      startingPlayerId: firstBlowPlayer.id,
      currentBlowIndex:
        (state.blowState.currentBlowIndex + 1) % state.players.length, // Increment and wrap around
    };

    // Emit blow phase started
    this.server.emit('blow-started', {
      startingPlayer: firstBlowPlayer.id,
      players: state.players,
    });

    // Emit phase update
    this.server.emit('update-phase', {
      phase: 'blow',
      scores: state.teamScores,
      winner: null,
    });

    // Emit turn update
    this.server.emit('update-turn', firstBlowPlayer.id);
  }
}
