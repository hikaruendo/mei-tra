import { GameState } from '../types/game.types';
import { GameStateService } from '../services/game-state.service';
import { IBlowService } from '../services/interfaces/blow-service.interface';
import { ICardService } from '../services/interfaces/card-service.interface';
import { IChomboService } from '../services/interfaces/chombo-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';

export interface TransitionResult {
  events: GatewayEvent[];
  delayedEvents: GatewayEvent[];
  revealBrokenRequest?: {
    roomId: string;
    playerId: string;
    socketId: string;
  };
}

interface TransitionParams {
  roomId: string;
  roomGameState: GameStateService;
  state: GameState;
  blowService: IBlowService;
  cardService: ICardService;
  chomboService: IChomboService;
}

export async function transitionToPlayPhase({
  roomId,
  roomGameState,
  state,
  blowService,
  cardService,
  chomboService,
}: TransitionParams): Promise<TransitionResult> {
  const highestDeclaration = blowService.findHighestDeclaration(
    state.blowState.declarations,
  );
  const winningPlayer = state.players.find(
    (p) => p.playerId === highestDeclaration.playerId,
  );

  if (!winningPlayer) {
    return { events: [], delayedEvents: [] };
  }

  if (state.agari) {
    winningPlayer.hand.push(state.agari);
  }
  winningPlayer.hand.sort((a, b) => cardService.compareCards(a, b));
  chomboService.checkForRequiredBrokenHand(winningPlayer);

  state.gamePhase = 'play';
  state.blowState.currentTrump = highestDeclaration.trumpType;
  const winnerIndex = state.players.findIndex(
    (p) => p.playerId === winningPlayer.playerId,
  );
  if (winnerIndex !== -1) {
    state.currentPlayerIndex = winnerIndex;
  }

  const events: GatewayEvent[] = [
    {
      scope: 'room',
      roomId,
      event: 'update-players',
      payload: state.players,
    },
  ];

  const delayedEvents: GatewayEvent[] = [
    {
      scope: 'socket',
      socketId: winningPlayer.id,
      event: 'reveal-agari',
      payload: {
        agari: state.agari,
        message: 'Select a card from your hand as Negri',
        playerId: winningPlayer.playerId,
      },
      delayMs: 3000,
    },
    {
      scope: 'room',
      roomId,
      event: 'update-turn',
      payload: winningPlayer.playerId,
      delayMs: 3000,
    },
    {
      scope: 'room',
      roomId,
      event: 'update-phase',
      payload: {
        phase: 'play',
        scores: state.teamScores,
        winner: winningPlayer.team,
        currentHighestDeclaration: state.blowState.currentHighestDeclaration,
      },
      delayMs: 3000,
    },
  ];

  const revealBrokenRequest = winningPlayer.hasRequiredBroken
    ? {
        roomId,
        playerId: winningPlayer.playerId,
        socketId: winningPlayer.id,
      }
    : undefined;

  await roomGameState.saveState();

  return {
    events,
    delayedEvents,
    revealBrokenRequest,
  };
}
