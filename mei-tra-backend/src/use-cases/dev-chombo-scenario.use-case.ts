import { Inject, Injectable } from '@nestjs/common';
import type {
  NewRoundStartedPayload,
  RevealAgariPayload,
} from '@contracts/game';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { ICardService } from '../services/interfaces/card-service.interface';
import type { BlowDeclaration } from '../types/game.types';
import { asSeatId } from '../types/identity.types';
import { setCurrentSeat } from '../domain/current-turn';
import {
  toBlowDeclarationContract,
  toCompletedFieldContract,
  toFieldContract,
} from '../adapters/game-contract-adapters';
import {
  resolvePlayerByActorId,
  resolveTransportPlayers,
} from './helpers/player-resolution.helper';
import { buildDevChomboScenario } from './helpers/dev-chombo-scenarios';
import type { GatewayEvent } from './interfaces/gateway-event.interface';
import type {
  DevChomboScenarioRequest,
  DevChomboScenarioResponse,
  IDevChomboScenarioUseCase,
} from './interfaces/dev-chombo-scenario.use-case.interface';

/**
 * Development only. Rearranges a pro mode game so the requesting player can
 * commit one chombo straight away; random deals rarely produce most of them.
 */
@Injectable()
export class DevChomboScenarioUseCase implements IDevChomboScenarioUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('ICardService') private readonly cardService: ICardService,
  ) {}

  async execute(
    request: DevChomboScenarioRequest,
  ): Promise<DevChomboScenarioResponse> {
    if (process.env.NODE_ENV === 'production') {
      return {
        success: false,
        error: 'Chombo scenarios are only available in development',
      };
    }

    const { roomId, actorId, violationType } = request;
    const room = await this.roomService.getRoom(roomId);
    if (!room || room.settings.gameMode !== 'pro') {
      return { success: false, error: 'Chombo scenarios need a pro mode room' };
    }

    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();
    if (state.gamePhase !== 'blow' && state.gamePhase !== 'play') {
      return {
        success: false,
        error: 'Chombo scenarios need a game in progress',
      };
    }
    if (state.players.length !== 4) {
      return { success: false, error: 'Chombo scenarios need four seats' };
    }

    const player = resolvePlayerByActorId(roomGameState, actorId);
    if (!player || player.isCOM) {
      return { success: false, error: 'Player not found in game state' };
    }

    const scenario = buildDevChomboScenario({
      seats: state.players.map(({ seatId, team }) => ({
        seatId: asSeatId(seatId),
        team,
      })),
      requesterSeatId: asSeatId(player.seatId),
      type: violationType,
      deck: this.cardService.generateDeck(),
    });
    const declaration: BlowDeclaration = {
      seatId: scenario.declarerSeatId,
      team: state.players.find(
        (seat) => seat.seatId === scenario.declarerSeatId,
      )?.team,
      trumpType: scenario.trump,
      numberOfPairs: 6,
      timestamp: Date.now(),
    };
    const negriSeatId = scenario.negriCard ? scenario.declarerSeatId : null;

    state.players.forEach((seat) => {
      seat.hand = [...(scenario.hands[seat.seatId] ?? [])].sort((a, b) =>
        this.cardService.compareCards(a, b),
      );
      seat.isPasser = false;
      seat.hasBroken = false;
      seat.hasRequiredBroken = false;
    });
    state.gamePhase = 'play';
    state.pendingBrokenHandReveal = null;
    state.agari = scenario.agari ?? undefined;
    state.blowState = {
      ...state.blowState,
      currentTrump: scenario.trump,
      currentHighestDeclaration: declaration,
      declarations: [declaration],
      actionHistory: [
        {
          type: 'declare',
          seatId: declaration.seatId,
          trumpType: declaration.trumpType,
          numberOfPairs: declaration.numberOfPairs,
          timestamp: declaration.timestamp,
        },
      ],
      lastPasserSeatId: null,
      isRoundCancelled: false,
    };
    state.playState = {
      currentField: scenario.currentField,
      negriCard: scenario.negriCard,
      negriSeatId,
      neguri:
        negriSeatId && scenario.negriCard
          ? { [negriSeatId]: scenario.negriCard }
          : {},
      fields: scenario.fields,
      lastWinnerSeatId: scenario.lastWinnerSeatId,
      openDeclared: false,
      openDeclarerSeatId: null,
      revealedHands: {},
      openResolved: false,
      fieldCheckpoint: null,
      chomboViolations: [],
      chomboReports: [],
      chomboRoundNumber: state.roundNumber,
    };
    setCurrentSeat(state, scenario.currentSeatId);
    await roomGameState.saveState();

    const newRoundPayload: NewRoundStartedPayload = {
      players: resolveTransportPlayers(roomGameState, state.players, {
        roomPlayers: room.players,
      }),
      currentTurnSeatId: scenario.currentSeatId,
      gamePhase: 'play',
      currentField: scenario.currentField
        ? toFieldContract(scenario.currentField)
        : null,
      completedFields: scenario.fields.map((field) =>
        toCompletedFieldContract(field),
      ),
      negriCard: scenario.negriCard,
      negriSeatId,
      revealedAgari: null,
      currentTrump: scenario.trump,
      currentHighestDeclaration: toBlowDeclarationContract(declaration),
      blowDeclarations: [toBlowDeclarationContract(declaration)],
    };
    const events: GatewayEvent[] = [
      {
        scope: 'room',
        roomId,
        event: 'new-round-started',
        payload: newRoundPayload,
      },
    ];

    const agariSocketId = roomGameState.findSessionUserBySeatId(
      scenario.declarerSeatId,
    )?.socketId;
    if (scenario.agari && agariSocketId) {
      const revealAgariPayload: RevealAgariPayload = {
        agari: scenario.agari,
        message: 'Select a card from your hand as Negri',
        seatId: scenario.declarerSeatId,
      };
      events.push({
        scope: 'socket',
        socketId: agariSocketId,
        event: 'reveal-agari',
        payload: revealAgariPayload,
      });
    }

    events.push({
      scope: 'room',
      roomId,
      event: 'update-turn',
      payload: scenario.currentSeatId,
    });

    return { success: true, events };
  }
}
