import { transitionToPlayPhase } from '../blow-phase-transition.helper';
import { GameStateService } from '../../services/game-state.service';
import { GameState } from '../../types/game.types';
import { Room, RoomStatus } from '../../types/room.types';
import { IBlowService } from '../../services/interfaces/blow-service.interface';
import { ICardService } from '../../services/interfaces/card-service.interface';
import { asSeatId } from '../../types/identity.types';
import { PLAY_PHASE_REVEAL_DELAY_MS } from '@contracts/game';

describe('transitionToPlayPhase', () => {
  it('reveals the Agari card using room player socket when session lookup is empty', async () => {
    const declaration = {
      seatId: asSeatId('player-1'),
      trumpType: 'club' as const,
      numberOfPairs: 6,
      timestamp: 1,
    };
    const state: GameState = {
      players: [
        {
          seatId: asSeatId('player-1'),
          name: 'Player 1',
          team: 0 as const,
          hand: ['H-7'],
          isPasser: false,
        },
        {
          seatId: asSeatId('player-2'),
          name: 'Player 2',
          team: 1 as const,
          hand: ['S-9'],
          isPasser: false,
        },
      ],
      currentSeatId: asSeatId('player-1'),
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
        lastPasserSeatId: null,
        isRoundCancelled: false,
        currentBlowIndex: 0,
      },
      playState: {
        currentField: null,
        negriCard: null,
        neguri: {},
        fields: [],
        lastWinnerSeatId: null,
        openDeclared: false,
        openDeclarerSeatId: null,
      },
      roundNumber: 1,
      pointsToWin: 10,
    };
    const room = {
      id: 'room-1',
      name: 'Room 1',
      hostSeatId: asSeatId('player-1'),
      status: RoomStatus.PLAYING,
      players: [
        {
          socketId: 'socket-from-room',
          seatId: asSeatId('player-1'),
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
      findSessionUserBySeatId: jest.fn(() => null),
      saveState: jest.fn(),
    } as unknown as GameStateService;
    const blowService = {
      findHighestDeclaration: jest.fn(() => declaration),
    } as unknown as IBlowService;
    const cardService = {
      compareCards: jest.fn(() => 0),
    } as unknown as ICardService;
    const result = await transitionToPlayPhase({
      roomId: 'room-1',
      roomGameState,
      room,
      state,
      blowService,
      cardService,
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
        seatId: asSeatId('player-1'),
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

    // The hand carrying the agari must not go out ahead of the reveal that
    // names it, so nothing this transition produces is emitted immediately.
    expect(result.events).toEqual([]);
    const playerSyncEvent = result.delayedEvents.find(
      (event) =>
        event.event === 'room-sync' || event.event === 'update-players',
    );
    expect(playerSyncEvent).toBeDefined();
    expect(playerSyncEvent?.delayMs).toBe(PLAY_PHASE_REVEAL_DELAY_MS);
    expect(
      result.delayedEvents.every(
        (event) => event.delayMs === PLAY_PHASE_REVEAL_DELAY_MS,
      ),
    ).toBe(true);
    // The winner's hand has to be on the client before reveal-agari asks them
    // to pick a negri out of it.
    expect(result.delayedEvents.indexOf(playerSyncEvent!)).toBeLessThan(
      result.delayedEvents.indexOf(revealAgariEvent!),
    );
  });

  it('does not request broken reveal after the Agari card is added', async () => {
    const declaration = {
      seatId: asSeatId('player-1'),
      trumpType: 'club' as const,
      numberOfPairs: 6,
      timestamp: 1,
    };
    const state: GameState = {
      players: [
        {
          seatId: asSeatId('player-1'),
          name: 'Player 1',
          team: 0 as const,
          hand: ['J♠', 'J♣', 'J♥'],
          isPasser: false,
          hasRequiredBroken: false,
        },
      ],
      currentSeatId: asSeatId('player-1'),
      gamePhase: 'blow',
      deck: [],
      agari: 'J♦',
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
        lastPasserSeatId: null,
        isRoundCancelled: false,
        currentBlowIndex: 0,
      },
      playState: {
        currentField: null,
        negriCard: null,
        neguri: {},
        fields: [],
        lastWinnerSeatId: null,
        openDeclared: false,
        openDeclarerSeatId: null,
      },
      roundNumber: 1,
      pointsToWin: 10,
    };
    const roomGameState = {
      transitionPhase: jest.fn(async (phase: GameState['gamePhase']) => {
        state.gamePhase = phase;
      }),
      getState: jest.fn(() => state),
      getTransportPlayers: jest.fn(() => state.players),
      findSessionUserBySeatId: jest.fn(() => null),
      saveState: jest.fn(),
    } as unknown as GameStateService;
    const blowService = {
      findHighestDeclaration: jest.fn(() => declaration),
    } as unknown as IBlowService;
    const cardService = {
      compareCards: jest.fn(() => 0),
    } as unknown as ICardService;

    const result = await transitionToPlayPhase({
      roomId: 'room-1',
      roomGameState,
      state,
      blowService,
      cardService,
    });

    expect(state.players[0].hand).toEqual(['J♠', 'J♣', 'J♥', 'J♦']);
    expect(state.players[0].hasRequiredBroken).toBe(false);
    expect(state.gamePhase).toBe('play');
    expect(
      result.delayedEvents.some(
        (event) =>
          event.event === 'update-phase' &&
          typeof event.payload === 'object' &&
          event.payload !== null &&
          'phase' in event.payload &&
          event.payload.phase === 'play',
      ),
    ).toBe(true);
  });
});
