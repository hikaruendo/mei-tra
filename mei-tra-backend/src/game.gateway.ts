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
}

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  players: Player[] = [];
  deck: string[] = [];
  currentPlayerIndex: number = 0; // Add this line

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

    this.deck = this.generateDeck();
    this.dealCards();

    // Set the first turn to the first player
    this.currentPlayerIndex = 0;
    this.server.emit('update-turn', this.players[0].id);
    this.server.emit('update-players', this.players);
    this.server.emit('game-started', this.players);
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

  @SubscribeMessage('end-turn')
  handleEndTurn(client: Socket) {
    if (this.players[this.currentPlayerIndex].id !== client.id) {
      console.log(`Player ${client.id} tried to end turn out of order`);
      return;
    }
    this.nextTurn();
  }

  @SubscribeMessage('draw-card')
  handleDrawCard(client: Socket, { fromPlayerId }: { fromPlayerId: string }) {
    const toPlayer = this.players.find((p) => p.id === client.id);
    const fromPlayer = this.players.find((p) => p.id === fromPlayerId);

    if (!toPlayer || !fromPlayer) {
      console.log('Invalid draw request');
      return;
    }

    if (this.players[this.currentPlayerIndex].id !== client.id) {
      console.log('Not your turn');
      client.emit('error-message', "It's not your turn!");
      return;
    }

    if (fromPlayer.hand.length === 0) {
      console.log(`Player ${fromPlayer.name} has no cards to draw`);
      client.emit('error-message', 'This player has no cards left.');
      return;
    }

    // 🔹 Randomly pick a card from the opponent's hand
    const randomIndex = Math.floor(Math.random() * fromPlayer.hand.length);
    const [drawnCard] = fromPlayer.hand.splice(randomIndex, 1);
    toPlayer.hand.push(drawnCard);

    console.log(`${toPlayer.name} drew ${drawnCard} from ${fromPlayer.name}`);

    // 🔹 Remove pairs from both hands
    fromPlayer.hand = this.removePairs(fromPlayer.hand);
    toPlayer.hand = this.removePairs(toPlayer.hand);

    this.server.emit('update-players', this.players);

    // 🔹 Move to the next player's turn
    this.nextTurn();
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

    const numPlayers = this.players.length;

    // Ensure players have empty hands before dealing
    this.players.forEach((player) => {
      player.hand = [];
    });

    // Deal cards
    for (let i = 0; i < this.deck.length; i += 1) {
      this.players[i % numPlayers].hand.push(this.deck[i]);
    }

    console.log(
      'Players before removing pairs:',
      this.players.map((p) => ({
        name: p.name,
        hand: p.hand,
      })),
    );

    // Remove pairs
    this.players.forEach((player) => {
      player.hand = this.removePairs(player.hand);
      console.log(`Player ${player.name} after removing pairs:`, player.hand);
    });

    // Ensure no player has an empty hand
    this.players.forEach((player) => {
      if (player.hand.length === 0) {
        console.log(
          `Warning: Player ${player.name} has no cards after removing pairs.`,
        );
      }
    });
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
