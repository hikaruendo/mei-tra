import {
  WebSocketGateway,
  SubscribeMessage,
  // MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface Player {
  id: string;
  name: string;
  hand: string[];
  team: number;
  isPasser?: boolean;
}

interface TeamScore {
  deal: number;
  blow: number;
  play: number;
  total: number;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  players: Player[] = [];
  deck: string[] = [];
  currentPlayerIndex: number = 0;
  agari: string | null = null;
  teamScores: { [key: number]: TeamScore } = {
    0: { deal: 0, blow: 0, play: 0, total: 0 },
    1: { deal: 0, blow: 0, play: 0, total: 0 },
  };
  gamePhase: 'deal' | 'blow' | 'play' | null = null;

  handleConnection(client: Socket) {
    console.log(`Player connected: ${client.id}`);
    if (this.deck.length > 0 && this.players.length > 0) {
      this.dealCards();
      this.server.emit('update-players', this.players);
    }
  }

  handleDisconnect(client: Socket) {
    this.players = this.players.filter((p) => p.id !== client.id);
    this.server.emit('update-players', this.players);
    console.log(`Player disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-game')
  handleJoinGame(client: Socket, name: string) {
    if (this.players.length < 4) {
      // Assign team based on player order
      const team = Math.floor(this.players.length / 2);
      this.players.push({ id: client.id, name, hand: [], team });
      this.server.emit('update-players', this.players);
    } else {
      client.emit('error-message', 'Game is full!');
    }
  }

  @SubscribeMessage('start-game')
  handleStartGame(): void {
    console.log('Game starting...');

    if (this.players.length !== 4) {
      console.log('Need exactly 4 players to start the game.');
      return;
    }

    // Reset scores and game state
    this.teamScores = {
      0: { deal: 0, blow: 0, play: 0, total: 0 },
      1: { deal: 0, blow: 0, play: 0, total: 0 },
    };
    this.agari = null;

    // Start with deal phase
    this.gamePhase = 'deal';
    this.deck = this.generateDeck();
    this.dealCards();

    // Set the first turn to the first player
    this.currentPlayerIndex = 0;
    this.server.emit('update-turn', this.players[0].id);
    this.server.emit('update-players', this.players);
    this.server.emit('game-started', this.players);
    this.server.emit('update-phase', {
      phase: 'deal',
      scores: this.teamScores,
    });
  }

  @SubscribeMessage('remove-initial-pairs')
  handleRemoveInitialPairs(): void {
    this.players.forEach((player) => {
      player.hand = this.removePairs(player.hand); // ✅ Now correctly passes string[]
    });
    this.server.emit('update-players', this.players);
  }

  @SubscribeMessage('discard-pairs')
  handleDiscardPairs(client: Socket, selectedCards: string[]) {
    console.log(`Received discard-pairs from ${client.id}:`, selectedCards);

    const player = this.players.find((p) => p.id === client.id);
    if (!player) {
      console.log('Player not found for ID:', client.id);
      return;
    }

    if (this.players[this.currentPlayerIndex].id !== client.id) {
      console.log(`Player ${client.id} tried to discard out of turn`);
      client.emit('error-message', "It's not your turn!");
      return;
    }

    if (!selectedCards.every((card) => player.hand.includes(card))) {
      client.emit('error-message', 'Invalid card selection.');
      return;
    }

    const [card1, card2] = selectedCards;
    const value1 = card1.replace(/[♠♣♥♦]/, '');
    const value2 = card2.replace(/[♠♣♥♦]/, '');

    if (value1 === value2) {
      console.log(`Valid pair found: ${card1} & ${card2}`);
      player.hand = player.hand.filter((card) => !selectedCards.includes(card));
      console.log(`Player ${player.name} new hand:`, player.hand);

      this.server.emit('update-players', this.players);

      this.checkGameOver();
    } else {
      client.emit('error-message', 'Selected cards do not form a valid pair.');
    }
  }

  @SubscribeMessage('end-phase')
  handleEndPhase(client: Socket) {
    if (this.players[this.currentPlayerIndex].id !== client.id) {
      console.log(`Player ${client.id} tried to end phase out of order`);
      return;
    }

    if (!this.gamePhase) {
      client.emit('error-message', 'No active game phase');
      return;
    }

    // Calculate phase winner
    const phaseWinner = this.calculatePhaseWinner();
    if (phaseWinner !== null) {
      // Award point to winning team
      this.teamScores[phaseWinner][this.gamePhase]++;
      this.teamScores[phaseWinner].total++;

      // Emit updated scores
      this.server.emit('update-phase', {
        phase: this.gamePhase,
        scores: this.teamScores,
        winner: phaseWinner,
      });

      // Check if game is over (17 points)
      if (this.teamScores[phaseWinner].total >= 17) {
        this.handleGameOver(phaseWinner);
        return;
      }

      // Move to next phase
      switch (this.gamePhase) {
        case 'deal':
          this.gamePhase = 'blow';
          this.deck = this.generateDeck();
          this.dealCards();
          break;
        case 'blow':
          this.gamePhase = 'play';
          this.deck = this.generateDeck();
          this.dealCards();
          break;
        case 'play':
          this.gamePhase = 'deal';
          this.deck = this.generateDeck();
          this.dealCards();
          break;
      }

      // Reset turn to first player
      this.currentPlayerIndex = 0;
      this.server.emit('update-turn', this.players[0].id);
      this.server.emit('update-phase', {
        phase: this.gamePhase,
        scores: this.teamScores,
      });
    }
  }

  private calculatePhaseWinner(): number | null {
    // For deal phase: team with most pairs
    if (this.gamePhase === 'deal') {
      const team0Pairs = this.countTeamPairs(0);
      const team1Pairs = this.countTeamPairs(1);
      return team0Pairs > team1Pairs ? 0 : team1Pairs > team0Pairs ? 1 : null;
    }

    // For blow phase: team with most cards
    if (this.gamePhase === 'blow') {
      const team0Cards = this.countTeamCards(0);
      const team1Cards = this.countTeamCards(1);
      return team0Cards > team1Cards ? 0 : team1Cards > team0Cards ? 1 : null;
    }

    // For play phase: team with most pairs
    if (this.gamePhase === 'play') {
      const team0Pairs = this.countTeamPairs(0);
      const team1Pairs = this.countTeamPairs(1);
      return team0Pairs > team1Pairs ? 0 : team1Pairs > team0Pairs ? 1 : null;
    }

    return null;
  }

  private countTeamPairs(team: number): number {
    return this.players
      .filter((p) => p.team === team)
      .reduce((total, player) => {
        const pairs = this.countPairs(player.hand);
        return total + pairs;
      }, 0);
  }

  private countTeamCards(team: number): number {
    return this.players
      .filter((p) => p.team === team)
      .reduce((total, player) => total + player.hand.length, 0);
  }

  private countPairs(hand: string[]): number {
    const countMap: Record<string, number> = {};
    hand.forEach((card) => {
      const value = card.replace(/[♠♣♥♦]/, '');
      countMap[value] = (countMap[value] || 0) + 1;
    });
    return Object.values(countMap).reduce(
      (total, count) => total + Math.floor(count / 2),
      0,
    );
  }

  private handleGameOver(winningTeam: number) {
    const winningTeamPlayers = this.players.filter(
      (p) => p.team === winningTeam,
    );
    const winningTeamNames = winningTeamPlayers
      .map((p) => p.name)
      .join(' and ');

    console.log(`Game Over! Team ${winningTeam} wins!`);
    this.server.emit('game-over', {
      winner: `Team ${winningTeam} (${winningTeamNames})`,
      winningTeam,
      finalScores: this.teamScores,
    });

    // Reset game state
    setTimeout(() => {
      this.players = [];
      this.deck = [];
      this.currentPlayerIndex = 0;
      this.gamePhase = null;
      this.teamScores = {
        0: { deal: 0, blow: 0, play: 0, total: 0 },
        1: { deal: 0, blow: 0, play: 0, total: 0 },
      };
    }, 500);
  }

  private hasPairs(hand: string[]): boolean {
    const countMap: Record<string, number> = {};

    hand.forEach((card) => {
      const value = card.replace(/[♠♣♥♦]/u, '');
      countMap[value] = (countMap[value] || 0) + 1;
    });

    return Object.values(countMap).some((count) => count >= 2);
  }

  private nextTurn(): void {
    if (this.players.length === 0) {
      console.log('No players left to take a turn.');
      return;
    }

    // Check if the game is over before moving to the next turn
    this.checkGameOver();

    // Move to the next player
    this.currentPlayerIndex =
      (this.currentPlayerIndex + 1) % this.players.length;
    const currentPlayer = this.players[this.currentPlayerIndex];

    console.log(
      `Next turn: ${currentPlayer.name} (Team ${currentPlayer.team})`,
    );

    // Broadcast the new turn to all players
    this.server.emit('update-turn', currentPlayer.id);
  }

  private removePairs(hand: string[]): string[] {
    const countMap: Record<string, number> = {};

    // Count occurrences of each card value (ignoring suits)
    hand.forEach((card) => {
      const value = card.replace(/[♠♣♥♦]/u, '');
      countMap[value] = (countMap[value] || 0) + 1;
    });

    // Keep only cards that appear an odd number of times
    return hand.filter((card) => {
      const value = card.replace(/[♠♣♥♦]/u, '');
      return countMap[value] % 2 !== 0;
    });
  }

  private generateDeck(): string[] {
    const suits = ['♠', '♣', '♥', '♦'];
    const values = ['5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: string[] = [];

    suits.forEach((suit) =>
      values.forEach((value) => deck.push(`${value}${suit}`)),
    );
    deck.push('JOKER');

    // Shuffle the deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
  }

  private dealCards(): void {
    console.log('Dealing cards...');

    if (this.players.length === 0) {
      console.log('No players to deal cards to.');
      return;
    }

    if (this.deck.length === 0) {
      this.deck = this.generateDeck();
      console.log('Deck generated:', this.deck);
    }

    // Shuffle deck
    this.deck.sort(() => Math.random() - 0.5);
    console.log('Shuffled deck:', this.deck);

    // Ensure players have empty hands before dealing
    this.players.forEach((player) => {
      player.hand = [];
      player.isPasser = false;
    });

    // Deal exactly 10 cards to each player
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < this.players.length; j++) {
        this.players[j].hand.push(this.deck[i * this.players.length + j]);
      }
    }

    // Set the Agari card (remaining card)
    this.agari = this.deck[40];

    console.log('Agari card:', this.agari);
    console.log(
      'Players after dealing:',
      this.players.map((p) => ({
        name: p.name,
        hand: p.hand,
        isPasser: p.isPasser,
      })),
    );

    // Emit the Agari card to all players
    this.server.emit('update-agari', { agari: this.agari });
    this.server.emit('update-players', this.players);
  }

  private checkGameOver() {
    // Check if any team has won (all players in a team have no cards)
    const team0Players = this.players.filter((p) => p.team === 0);
    const team1Players = this.players.filter((p) => p.team === 1);

    const team0Won = team0Players.every((p) => p.hand.length === 0);
    const team1Won = team1Players.every((p) => p.hand.length === 0);

    if (team0Won || team1Won) {
      const winningTeam = team0Won ? 0 : 1;
      const winningTeamPlayers = team0Won ? team0Players : team1Players;
      const winningTeamNames = winningTeamPlayers
        .map((p) => p.name)
        .join(' and ');

      console.log(`Game Over! Team ${winningTeam} wins!`);
      this.server.emit('game-over', {
        winner: `Team ${winningTeam} (${winningTeamNames})`,
        winningTeam,
      });

      // Reset game state
      setTimeout(() => {
        this.players = [];
        this.deck = [];
        this.currentPlayerIndex = 0;
      }, 500);
    }
  }
}
