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

  handleConnection(client: Socket) {
    console.log(`Player connected: ${client.id}`);
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
  handleStartGame() {
    this.deck = this.generateDeck();
    this.dealCards();
    this.server.emit('game-started', this.players);
  }

  @SubscribeMessage('draw-card')
  handleDrawCard(client: Socket, { fromPlayerId }: { fromPlayerId: string }) {
    const fromPlayer = this.players.find((p) => p.id === fromPlayerId);
    const toPlayer = this.players.find((p) => p.id === client.id);

    if (fromPlayer && toPlayer && fromPlayer.hand.length > 0) {
      const randomIndex = Math.floor(Math.random() * fromPlayer.hand.length);
      const [card] = fromPlayer.hand.splice(randomIndex, 1);
      toPlayer.hand.push(card);
      this.server.emit('update-players', this.players);
    }
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
    return deck;
  }

  private dealCards() {
    this.deck.sort(() => Math.random() - 0.5);
    const numPlayers = this.players.length;

    this.players.forEach((player) => (player.hand = []));
    for (let i = 0; i < this.deck.length; i++) {
      this.players[i % numPlayers].hand.push(this.deck[i]);
    }
  }
}
