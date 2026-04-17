import type { UpdatePhasePayload } from '@contracts/game';
import { GameState } from '../types/game.types';
import { Room } from '../types/room.types';
import { GameStateService } from '../services/game-state.service';
import { IBlowService } from '../services/interfaces/blow-service.interface';
import { ICardService } from '../services/interfaces/card-service.interface';
import { IChomboService } from '../services/interfaces/chombo-service.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { buildPlayerSyncEvents } from './helpers/player-resolution.helper';
import { GatewayEvent } from './interfaces/gateway-event.interface';

export interface TransitionResult {
  events: GatewayEvent[];
  delayedEvents: GatewayEvent[];
  revealBrokenRequest?: {
    roomId: string;
    playerId: string;
    actorId: string;
  };
}

interface TransitionParams {
  roomId: string;
  roomGameState: GameStateService;
  room?: Room | null;
  state: GameState;
  blowService: IBlowService;
  cardService: ICardService;
  chomboService: IChomboService;
  gameEventLogService?: IGameEventLogService;
}

export async function transitionToPlayPhase({
  roomId,
  roomGameState,
  room,
  state,
  blowService,
  cardService,
  chomboService,
  gameEventLogService,
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

  await roomGameState.transitionPhase('play');
  const nextState = roomGameState.getState();

  nextState.blowState.currentTrump = highestDeclaration.trumpType;
  const winnerIndex = nextState.players.findIndex(
    (p) => p.playerId === winningPlayer.playerId,
  );
  if (winnerIndex !== -1) {
    nextState.currentPlayerIndex = winnerIndex;
  }

  const events: GatewayEvent[] = buildPlayerSyncEvents(
    roomGameState,
    roomId,
    nextState.players,
    { room },
  );

  const updatePhasePayload: UpdatePhasePayload = {
    phase: 'play',
    scores: nextState.teamScores,
    winner: winningPlayer.team,
    currentHighestDeclaration: nextState.blowState.currentHighestDeclaration,
  };

  const delayedEvents: GatewayEvent[] = [
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
      payload: updatePhasePayload,
      delayMs: 3000,
    },
  ];

  const winningPlayerSession = roomGameState.findSessionUserByPlayerId(
    winningPlayer.playerId,
  );
  if (winningPlayerSession?.socketId) {
    delayedEvents.unshift({
      scope: 'socket',
      socketId: winningPlayerSession.socketId,
      event: 'reveal-agari',
      payload: {
        agari: state.agari,
        message: 'Select a card from your hand as Negri',
        playerId: winningPlayer.playerId,
      },
      delayMs: 3000,
    });
  }

  const revealBrokenRequest = winningPlayer.hasRequiredBroken
    ? {
        roomId,
        playerId: winningPlayer.playerId,
        actorId:
          winningPlayerSession?.userId ??
          winningPlayerSession?.socketId ??
          winningPlayer.playerId,
      }
    : undefined;

  await gameEventLogService?.log({
    roomId,
    actionType: 'play_phase_started',
    playerId: winningPlayer.playerId,
    state: nextState,
    actionData: {
      currentHighestDeclaration: nextState.blowState.currentHighestDeclaration,
      currentTrump: nextState.blowState.currentTrump,
      winnerPlayerId: winningPlayer.playerId,
      revealBrokenRequired: Boolean(revealBrokenRequest),
    },
  });

  await roomGameState.saveState();

  return {
    events,
    delayedEvents,
    revealBrokenRequest,
  };
}
