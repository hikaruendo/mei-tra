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
    if (state.deck.length > 0 && state.players.length > 0) {
      this.server.emit('update-players', state.players);
    }
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
  handleStartGame(): void {
    console.log('Game starting...');
    const success = this.gameState.startGame();
    if (!success) {
      console.log('Need exactly 4 players to start the game.');
      return;
    }

    const state = this.gameState.getState();

    // Randomly select first dealer
    const randomDealerIndex = Math.floor(Math.random() * state.players.length);
    state.currentPlayerIndex = randomDealerIndex;

    const currentPlayer = state.players[randomDealerIndex];
    if (!currentPlayer) return;

    // Emit initial game state
    this.server.emit('update-turn', currentPlayer.id);
    this.server.emit('update-players', state.players);
    this.server.emit('game-started', state.players);

    // Automatically start blow phase
    const firstBlowIndex = (randomDealerIndex + 1) % state.players.length;
    const firstBlowPlayer = state.players[firstBlowIndex];

    if (!firstBlowPlayer) {
      console.log('Cannot determine first player to blow!');
      return;
    }

    // Set up blow phase
    state.gamePhase = 'blow';
    state.currentPlayerIndex = firstBlowIndex;
    state.blowState = {
      currentTrump: null,
      currentHighestDeclaration: null,
      declarations: [],
      lastPasser: null,
      isRoundCancelled: false,
      startingPlayerId: firstBlowPlayer.id,
    };

    // Emit blow phase started
    this.server.emit('blow-started', {
      startingPlayer: firstBlowPlayer.id,
      players: state.players,
    });

    // Emit phase update
    this.server.emit('update-phase', {
      phase: state.gamePhase,
      scores: state.teamScores,
      winner: null,
    });
  }

  @SubscribeMessage('declare-blow')
  handleDeclareBlow(
    client: Socket,
    declaration: { trumpType: TrumpType; numberOfPairs: number },
  ) {
    if (!this.gameState.isPlayerTurn(client.id)) {
      client.emit('error-message', "It's not your turn!");
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
    const totalActions =
      state.blowState.declarations.length +
      state.players.filter((p) => p.isPasser).length;

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
    if (!this.gameState.isPlayerTurn(client.id)) {
      client.emit('error-message', "It's not your turn!");
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
    const totalActions =
      state.blowState.declarations.length +
      state.players.filter((p) => p.isPasser).length;

    // If all 4 players have acted (either declared or passed), move to play phase
    if (totalActions === 4) {
      // If no one has declared, start a new round
      if (state.blowState.declarations.length === 0) {
        // Reset player pass states
        state.players.forEach((p) => (p.isPasser = false));
        state.blowState.lastPasser = null;
        state.blowState.declarations = [];
        state.blowState.currentHighestDeclaration = null;

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
    } else {
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
  }

  private handleFourthDeclaration(): void {
    const state = this.gameState.getState();
    const winner = this.blowService.findHighestDeclaration(
      state.blowState.declarations,
    );
    const winningPlayer = state.players.find((p) => p.id === winner.playerId);
    if (!winningPlayer) return;

    // Move to play phase
    state.gamePhase = 'play';
    state.blowState.currentTrump = winner.trumpType;

    // Add Agari card to winner's hand
    if (state.agari) {
      winningPlayer.hand.push(state.agari);
    }

    // Set current player to the winner for Negri selection
    state.currentPlayerIndex = state.players.findIndex(
      (p) => p.id === winner.playerId,
    );

    // Emit updates
    this.server.emit('update-phase', {
      phase: 'play',
      scores: state.teamScores,
      winner: winningPlayer.team,
    });

    // Emit Agari card to winner
    this.server.to(winningPlayer.id).emit('reveal-agari', {
      agari: state.agari,
      message: 'Select a card from your hand as Negri',
    });

    // Update other players about the winner's new hand size
    this.server.emit('update-players', state.players);
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
      currentField: null,
      negriCard: card,
      neguri: {},
      fields: [],
      lastWinnerId: null,
      isTanzenRound: false,
      openDeclared: false,
      openDeclarerId: null,
    };

    // Initialize the first field after setting up play state
    this.gameState.startField(client.id);

    // Remove Negri card from hand
    player.hand = player.hand.filter((c) => c !== card);

    this.server.emit('update-players', state.players);
  }

  @SubscribeMessage('play-card')
  handlePlayCard(client: Socket, card: string) {
    if (!this.gameState.isPlayerTurn(client.id)) {
      client.emit('error-message', "It's not your turn!");
      return;
    }

    const state = this.gameState.getState();
    const player = state.players.find((p) => p.id === client.id);
    if (!player || !player.hand.includes(card)) {
      client.emit('error-message', 'Invalid card selection!');
      return;
    }

    const currentField = state.playState.currentField;
    if (!currentField) {
      client.emit('error-message', 'No active field!');
      return;
    }

    // Validate card play
    if (
      !this.playService.isValidCardPlay(
        player.hand,
        card,
        currentField,
        state.blowState.currentTrump,
        state.playState.isTanzenRound,
      )
    ) {
      client.emit('error-message', 'Invalid card play!');
      return;
    }

    // Play the card
    player.hand = player.hand.filter((c) => c !== card);
    currentField.cards.push(card);

    if (currentField.cards.length === 1) {
      currentField.baseCard = card;
    }

    // Check for Chombo violations
    this.chomboService.checkViolations(client.id, 'play-card', {
      player,
      field: currentField,
      card,
    });

    // Emit card played
    this.server.emit('card-played', {
      playerId: client.id,
      card,
      field: currentField,
    });

    // Check if field is complete
    if (currentField.cards.length === 4) {
      this.handleFieldComplete();
    } else {
      this.gameState.nextTurn();
    }
  }

  private handleFieldComplete(): void {
    const state = this.gameState.getState();
    const field = this.gameState.completeField();
    if (!field) return;

    // Determine winner
    const winner = this.playService.determineFieldWinner(
      field,
      state.players,
      state.blowState.currentTrump,
    );
    if (!winner) return;

    // Update state
    state.playState.lastWinnerId = winner.id;
    const winnerIndex = state.players.findIndex((p) => p.id === winner.id);
    if (winnerIndex >= 0) {
      state.currentPlayerIndex = winnerIndex;
    }

    // Emit field complete
    this.server.emit('field-complete', {
      winner: winner.id,
      field,
      players: state.players,
    });

    // Check if game is over
    if (state.players.every((p) => p.hand.length === 0)) {
      const winningTeam = this.playService.determineWinningTeam(
        state.playState.fields,
        state.players,
      );
      this.handleGameOver(winningTeam);
      return;
    }

    // Start new field
    this.gameState.startField(winner.id);
  }

  private handleGameOver(winningTeam: number): void {
    const state = this.gameState.getState();
    const playPoints = this.scoreService.calculatePlayPoints(
      winningTeam,
      state.blowState.currentHighestDeclaration?.numberOfPairs || 0,
      state.playState.fields.filter(
        (f) =>
          state.players.find((p) => p.id === f.dealerId)?.team === winningTeam,
      ).length,
    );

    // Update team scores
    if (playPoints > 0) {
      state.teamScores[winningTeam].play += playPoints;
      state.teamScores[winningTeam].total += playPoints;
      state.teamScoreRecords[winningTeam] = this.scoreService.updateTeamScore(
        winningTeam,
        playPoints,
        state.teamScoreRecords[winningTeam],
      );
    } else {
      const opposingTeam = winningTeam === 0 ? 1 : 0;
      state.teamScores[opposingTeam].play += Math.abs(playPoints);
      state.teamScores[opposingTeam].total += Math.abs(playPoints);
      state.teamScoreRecords[opposingTeam] = this.scoreService.updateTeamScore(
        opposingTeam,
        Math.abs(playPoints),
        state.teamScoreRecords[opposingTeam],
      );
    }

    // Check if any team has reached 17 points
    if (state.teamScores[0].total >= 17 || state.teamScores[1].total >= 17) {
      const finalWinner = state.teamScores[0].total >= 17 ? 0 : 1;
      const winningTeamPlayers = state.players.filter(
        (p) => p.team === finalWinner,
      );
      const winningTeamNames = winningTeamPlayers
        .map((p) => p.name)
        .join(' and ');

      // Emit game over
      this.server.emit('game-over', {
        winner: `Team ${finalWinner} (${winningTeamNames})`,
        winningTeam: finalWinner,
        finalScores: state.teamScores,
        scoreRecords: state.teamScoreRecords,
      });

      // Reset game state after delay
      setTimeout(() => {
        this.gameState.resetState();
      }, 5000);
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
    state.deck = this.cardService.generateDeck();
    this.gameState.dealCards();
    this.chomboService.expireViolations();

    // Emit round end
    this.server.emit('round-ended', {
      players: state.players,
      scores: state.teamScores,
      scoreRecords: state.teamScoreRecords,
    });
  }

  private checkGameOver(): void {
    const state = this.gameState.getState();
    const team0Players = state.players.filter((p) => p.team === 0);
    const team1Players = state.players.filter((p) => p.team === 1);

    const team0Won = team0Players.every((p) => p.hand.length === 0);
    const team1Won = team1Players.every((p) => p.hand.length === 0);

    if (team0Won || team1Won) {
      const winningTeam = team0Won ? 0 : 1;
      const winningTeamPlayers = team0Won ? team0Players : team1Players;
      const winningTeamNames = winningTeamPlayers
        .map((p) => p.name)
        .join(' and ');

      this.server.emit('game-over', {
        winner: `Team ${winningTeam} (${winningTeamNames})`,
        winningTeam,
      });

      setTimeout(() => {
        this.gameState.resetState();
      }, 500);
    }
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
    const firstBlowIndex = (dealerIndex + 1) % state.players.length;
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
