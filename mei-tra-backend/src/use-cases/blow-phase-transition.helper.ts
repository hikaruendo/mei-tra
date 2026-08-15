import type { UpdatePhasePayload } from '@contracts/game';
import { GameState } from '../types/game.types';
import { Room } from '../types/room.types';
import { GameStateService } from '../services/game-state.service';
import { IBlowService } from '../services/interfaces/blow-service.interface';
import { ICardService } from '../services/interfaces/card-service.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { buildPlayerSyncEvents } from './helpers/player-resolution.helper';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import { asSeatId } from '../types/identity.types';
import { setCurrentSeat } from '../domain/current-turn';
import type { RevealAgariPayload } from '@contracts/game';
import { toBlowDeclarationContract } from '../adapters/game-contract-adapters';

export interface TransitionResult {
  events: GatewayEvent[];
  delayedEvents: GatewayEvent[];
}

interface TransitionParams {
  roomId: string;
  roomGameState: GameStateService;
  room?: Room | null;
  state: GameState;
  blowService: IBlowService;
  cardService: ICardService;
  gameEventLogService?: IGameEventLogService;
}

export async function transitionToPlayPhase({
  roomId,
  roomGameState,
  room,
  state,
  blowService,
  cardService,
  gameEventLogService,
}: TransitionParams): Promise<TransitionResult> {
  const highestDeclaration = blowService.findHighestDeclaration(
    state.blowState.declarations,
  );
  const winningPlayer = state.players.find(
    (p) => p.seatId === highestDeclaration.seatId,
  );

  if (!winningPlayer) {
    return { events: [], delayedEvents: [] };
  }

  if (state.agari) {
    winningPlayer.hand.push(state.agari);
  }
  winningPlayer.hand.sort((a, b) => cardService.compareCards(a, b));

  roomGameState.transitionPhase('play');
  const nextState = roomGameState.getState();

  nextState.blowState.currentTrump = highestDeclaration.trumpType;
  setCurrentSeat(nextState, winningPlayer.seatId);

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
    currentHighestDeclaration: nextState.blowState.currentHighestDeclaration
      ? toBlowDeclarationContract(nextState.blowState.currentHighestDeclaration)
      : null,
  };

  const delayedEvents: GatewayEvent[] = [
    {
      scope: 'room',
      roomId,
      event: 'update-turn',
      payload: asSeatId(winningPlayer.seatId),
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
    winningPlayer.seatId,
  );
  const winningPlayerSocketId =
    winningPlayerSession?.socketId ??
    room?.players.find((player) => player.seatId === winningPlayer.seatId)
      ?.socketId;

  if (state.agari && winningPlayerSocketId) {
    const revealAgariPayload: RevealAgariPayload = {
      agari: state.agari,
      message: 'Select a card from your hand as Negri',
      seatId: asSeatId(winningPlayer.seatId),
    };
    delayedEvents.unshift({
      scope: 'socket',
      socketId: winningPlayerSocketId,
      event: 'reveal-agari',
      payload: revealAgariPayload,
      delayMs: 3000,
    });
  }

  await gameEventLogService?.log({
    roomId,
    actionType: 'play_phase_started',
    actorSeatId: asSeatId(winningPlayer.seatId),
    state: nextState,
    actionData: {
      currentHighestDeclaration: nextState.blowState.currentHighestDeclaration,
      currentTrump: nextState.blowState.currentTrump,
      winnerSeatId: winningPlayer.seatId,
    },
  });

  await roomGameState.saveState();

  return {
    events,
    delayedEvents,
  };
}
