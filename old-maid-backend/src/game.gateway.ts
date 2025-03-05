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
}

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  players: Player[] = [];
  deck: string[] = [];
  currentPlayerIndex: number = 0;

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
      this.players.push({ id: client.id, name, hand: [] });
      this.server.emit('update-players', this.players);
    } else {
      client.emit('game-full');
    }
  }

  @SubscribeMessage('start-game')
  handleStartGame(): void {
    console.log('Game starting...');

    if (this.players.length === 0) {
      console.log('No players to start the game.');
      return;
    }

    this.deck = this.generateDeck();
    this.dealCards();

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
    console.log('player', player);
    if (!player) return;

    // Check if the selected cards exist in the player's hand
    // if (!selectedCards.every((card) => player.hand.includes(card))) {
    //   client.emit('error-message', 'Invalid card selection.');
    //   return;
    // }

    // Extract the card values without suits
    const [card1, card2] = selectedCards;
    const value1 = card1.replace(/[♠♣♥♦]/, '');
    const value2 = card2.replace(/[♠♣♥♦]/, '');

    // Check if they form a valid pair
    if (value1 === value2) {
      console.log(`Valid pair found: ${card1} & ${card2}`);
      // Remove the selected cards from the player's hand
      player.hand = player.hand.filter((card) => !selectedCards.includes(card));
      console.log('player.hand', player.hand);

      // Notify all players of the updated hands
      this.server.emit('update-players', this.players);

      // Check if the game is over
      this.checkGameOver();
    } else {
      client.emit('error-message', 'Selected cards do not form a valid pair.');
    }
  }

  @SubscribeMessage('draw-card')
  handleDrawCard(client: Socket, { fromPlayerId }: { fromPlayerId: string }) {
    const toPlayer = this.players.find((p) => p.id === client.id);
    const fromPlayer = this.players.find((p) => p.id === fromPlayerId);

    if (!toPlayer || !fromPlayer) return;

    if (this.players[this.currentPlayerIndex].id !== client.id) {
      console.log('Not your turn');
      return;
    }

    if (fromPlayer && toPlayer && fromPlayer.hand.length > 0) {
      const randomIndex = Math.floor(Math.random() * fromPlayer.hand.length);
      const [card] = fromPlayer.hand.splice(randomIndex, 1);
      toPlayer.hand.push(card);
      fromPlayer.hand = this.removePairs(fromPlayer.hand);
      toPlayer.hand = this.removePairs(toPlayer.hand);
      this.server.emit('update-players', this.players);

      this.nextTurn();
    }
  }

  private nextTurn() {
    this.currentPlayerIndex =
      (this.currentPlayerIndex + 1) % this.players.length;
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
    const values = [
      'A',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      'J',
      'Q',
      'K',
    ];
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
    const remainingPlayers = this.players.filter(
      (player) => player.hand.length > 0,
    );

    if (
      remainingPlayers.length === 1 &&
      remainingPlayers[0].hand.includes('JOKER')
    ) {
      this.server.emit('game-over', { loser: remainingPlayers[0].name });
    }
  }
}
