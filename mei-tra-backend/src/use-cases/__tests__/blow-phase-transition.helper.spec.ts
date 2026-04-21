import { transitionToPlayPhase } from '../blow-phase-transition.helper';
import { GameStateService } from '../../services/game-state.service';
import { GameState } from '../../types/game.types';
import { Room, RoomStatus } from '../../types/room.types';
import { IBlowService } from '../../services/interfaces/blow-service.interface';
import { ICardService } from '../../services/interfaces/card-service.interface';
import { IChomboService } from '../../services/interfaces/chombo-service.interface';

describe('transitionToPlayPhase', () => {
  it('reveals the Agari card using room player socket when session lookup is empty', async () => {
    const declaration = {
      playerId: 'player-1',
      trumpType: 'club' as const,
      numberOfPairs: 6,
      timestamp: 1,
    };
    const state: GameState = {
      players: [
        {
          playerId: 'player-1',
          name: 'Player 1',
          team: 0 as const,
          hand: ['H-7'],
          isPasser: false,
        },
        {
          playerId: 'player-2',
          name: 'Player 2',
          team: 1 as const,
          hand: ['S-9'],
          isPasser: false,
        },
      ],
      currentPlayerIndex: 0,
      gamePhase: 'blow',
      deck: [],
      agari: 'H-A',
      teamScores: {
        0: { play: 0, total: 0 },
        1: { play: 0, total: 0 },
      },
      teamScoreRecords: {
        0: [],
        1: [],
      },
      blowState: {
        currentTrump: null,
        currentHighestDeclaration: declaration,
        declarations: [declaration],
        actionHistory: [],
        lastPasser: null,
        isRoundCancelled: false,
        currentBlowIndex: 0,
      },
      playState: {
        currentField: null,
        negriCard: null,
        neguri: {},
        fields: [],
        lastWinnerId: null,
        openDeclared: false,
        openDeclarerId: null,
      },
      roundNumber: 1,
      pointsToWin: 10,
      teamAssignments: {},
    };
    const room = {
      id: 'room-1',
      name: 'Room 1',
      hostId: 'player-1',
      status: RoomStatus.PLAYING,
      players: [
        {
          socketId: 'socket-from-room',
          playerId: 'player-1',
          name: 'Player 1',
          team: 0,
          hand: [],
          isPasser: false,
          isReady: true,
          isHost: true,
          joinedAt: new Date(),
        },
      ],
      settings: {
        maxPlayers: 4,
        isPrivate: false,
        password: null,
        teamAssignmentMethod: 'random',
        pointsToWin: 10,
        allowSpectators: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    } satisfies Room;
    const roomGameState = {
      transitionPhase: jest.fn(async (phase: GameState['gamePhase']) => {
        state.gamePhase = phase;
      }),
      getState: jest.fn(() => state),
      getTransportPlayers: jest.fn(() => [
        {
          ...state.players[0],
          socketId: 'socket-from-room',
        },
        {
          ...state.players[1],
          socketId: 'socket-2',
        },
      ]),
      findSessionUserByPlayerId: jest.fn(() => null),
      saveState: jest.fn(),
    } as unknown as GameStateService;
    const blowService = {
      findHighestDeclaration: jest.fn(() => declaration),
    } as unknown as IBlowService;
    const cardService = {
      compareCards: jest.fn(() => 0),
    } as unknown as ICardService;
    const chomboService = {
      checkForRequiredBrokenHand: jest.fn(),
    } as unknown as IChomboService;

    const result = await transitionToPlayPhase({
      roomId: 'room-1',
      roomGameState,
      room,
      state,
      blowService,
      cardService,
      chomboService,
    });

    expect(state.players[0].hand).toContain('H-A');
    const revealAgariEvent = result.delayedEvents.find(
      (event) => event.event === 'reveal-agari',
    );
    expect(revealAgariEvent).toMatchObject({
      scope: 'socket',
      socketId: 'socket-from-room',
      event: 'reveal-agari',
      payload: {
        agari: 'H-A',
        playerId: 'player-1',
      },
    });
    const updatePhaseEvent = result.delayedEvents.find(
      (event) => event.event === 'update-phase',
    );
    expect(updatePhaseEvent).toMatchObject({
      event: 'update-phase',
      payload: {
        phase: 'play',
      },
    });
    expect(updatePhaseEvent?.payload).not.toHaveProperty('agariCard');
    expect(updatePhaseEvent?.payload).not.toHaveProperty('agariPlayerId');
  });
});
