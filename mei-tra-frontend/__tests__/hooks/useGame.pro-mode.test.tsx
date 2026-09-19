import { act, renderHook } from '@testing-library/react';
import type { GameStatePayload } from '@contracts/game';
import { asSeatId } from '@contracts/ids';
import { PENDING_HAND_CARD_TIMEOUT_MS } from '@meitra/game-client/pending-hand-card';
import { useGame } from '@/hooks/useGame';

const mockHandlers = new Map<string, (payload: unknown) => void>();
const mockSocket = {
  id: 'viewer-socket',
  connected: true,
  on: jest.fn((event: string, handler: (payload: unknown) => void) => {
    mockHandlers.set(event, handler);
  }),
  off: jest.fn((event: string) => mockHandlers.delete(event)),
  emit: jest.fn(),
};
const mockSound = jest.fn();
const mockTranslate = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${Object.values(values).join(',')}` : key;
jest.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({ socket: mockSocket, isConnected: true, isConnecting: false }),
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'viewer' } }) }));
jest.mock('@/hooks/useSoundEffects', () => ({ useSoundEffects: () => mockSound }));
jest.mock('next-intl', () => ({ useTranslations: () => mockTranslate }));

const snapshot = (isSpectator: boolean): GameStatePayload => ({
  roomId: 'pro-room',
  gameMode: 'pro',
  players: [
    { seatId: asSeatId('viewer'), name: 'Viewer', team: 0, hand: ['5♣'] },
    { seatId: asSeatId('opponent'), name: 'Opponent', team: 1, hand: [] },
  ],
  gamePhase: 'play',
  currentField: null,
  currentTurnSeatId: asSeatId('opponent'),
  blowState: {
    currentTrump: 'club', currentHighestDeclaration: null,
    declarations: [], actionHistory: [], lastPasserSeatId: null,
    isRoundCancelled: false, currentBlowIndex: 0,
  },
  teamScores: { 0: { play: 0, total: 0 }, 1: { play: 5, total: 5 } },
  youSeatId: isSpectator ? null : asSeatId('viewer'),
  isSpectator,
  negriCard: '7♣',
  negriSeatId: asSeatId('viewer'),
  revealedHands: { [asSeatId('opponent')]: ['A♠', 'K♠'] },
  openDeclared: true,
  openResolved: false,
  fields: [],
  hostSeatId: asSeatId('viewer'),
  pointsToWin: 12,
});

describe('useGame pro-mode reconnect', () => {
  beforeEach(() => { mockHandlers.clear(); sessionStorage.clear(); });

  it.each([false, true])('restores revealed hands for spectator=%s', (isSpectator) => {
    const { result } = renderHook(() => useGame());
    const state = snapshot(isSpectator);
    act(() => mockHandlers.get('game-state')?.(state));

    expect(result.current.gameMode).toBe('pro');
    expect(result.current.openDeclared).toBe(true);
    expect(result.current.openResolved).toBe(false);
    expect(result.current.revealedHands).toEqual(state.revealedHands);
    expect(result.current.negriSeatId).toBe('viewer');
    expect(result.current.teamScores?.[1].total).toBe(5);
  });

  it('clears the previous public hand when the next snapshot has no reveal', () => {
    const { result } = renderHook(() => useGame());
    act(() => mockHandlers.get('game-state')?.(snapshot(false)));
    act(() => mockHandlers.get('game-state')?.({
      ...snapshot(false), gameMode: 'normal', revealedHands: undefined,
      openDeclared: false, openResolved: false,
    }));

    expect(result.current.gameMode).toBe('normal');
    expect(result.current.revealedHands).toEqual({});
    expect(result.current.openDeclared).toBe(false);
  });
});

describe('useGame Negri prompt', () => {
  beforeEach(() => { mockHandlers.clear(); sessionStorage.clear(); });

  it.each([
    // A pro declarer who forgets the Negri can be reported, so nothing reminds them.
    ['pro', undefined],
    ['normal', 'negriPrompt'],
  ] as const)('shows the Negri prompt for a %s-mode Agari reveal only outside pro mode', (gameMode, message) => {
    const { result } = renderHook(() => useGame());
    act(() => mockHandlers.get('game-state')?.({ ...snapshot(false), gameMode }));
    act(() => mockHandlers.get('reveal-agari')?.({
      agari: 'A♠',
      message: 'Select a card from your hand as Negri',
      seatId: asSeatId('viewer'),
    }));

    expect(result.current.notification?.message).toBe(message);
  });
});

describe('useGame pending hand card', () => {
  beforeEach(() => {
    mockHandlers.clear();
    sessionStorage.clear();
    mockSocket.emit.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const viewerTurn = (): GameStatePayload => ({
    ...snapshot(false),
    players: [
      { seatId: asSeatId('viewer'), name: 'Viewer', team: 0, hand: ['5♣', 'A♠'] },
      { seatId: asSeatId('opponent'), name: 'Opponent', team: 1, hand: ['K♥'] },
    ] as GameStatePayload['players'],
    currentTurnSeatId: asSeatId('viewer'),
  });

  const renderAtViewerTurn = () => {
    const hook = renderHook(() => useGame());
    act(() => mockHandlers.get('game-state')?.(viewerTurn()));
    return hook;
  };

  it('holds a played card until the server takes it out of the hand', () => {
    const { result } = renderAtViewerTurn();

    act(() => result.current.gameActions?.playCard('5♣'));
    expect(mockSocket.emit).toHaveBeenCalledWith('play-card', { roomId: 'pro-room', card: '5♣' });
    expect(result.current.pendingHandCard).toBe('5♣');

    act(() => mockHandlers.get('card-played')?.({
      seatId: asSeatId('viewer'),
      card: '5♣',
      field: {
        cards: ['5♣'],
        playedBySeatIds: [asSeatId('viewer')],
        baseCard: '5♣',
        dealerSeatId: asSeatId('viewer'),
        isComplete: false,
      },
      players: [
        { seatId: asSeatId('viewer'), name: 'Viewer', team: 0, hand: ['A♠'] },
        { seatId: asSeatId('opponent'), name: 'Opponent', team: 1, hand: ['K♥'] },
      ],
      nextSeatId: asSeatId('opponent'),
    }));
    expect(result.current.pendingHandCard).toBeNull();
  });

  it('gives the card back when the server refuses the play', () => {
    const { result } = renderAtViewerTurn();

    act(() => result.current.gameActions?.playCard('5♣'));
    act(() => mockHandlers.get('error-message')?.('Card already played or invalid'));

    expect(result.current.pendingHandCard).toBeNull();
  });

  it('gives the card back when the server answers neither way', () => {
    jest.useFakeTimers();
    const { result } = renderAtViewerTurn();

    act(() => result.current.gameActions?.selectNegri('A♠'));
    expect(result.current.pendingHandCard).toBe('A♠');

    act(() => jest.advanceTimersByTime(PENDING_HAND_CARD_TIMEOUT_MS));
    expect(result.current.pendingHandCard).toBeNull();
  });
});

describe('useGame open result', () => {
  beforeEach(() => { mockHandlers.clear(); sessionStorage.clear(); });

  it('names the team that scored when an open fails', () => {
    const { result } = renderHook(() => useGame());
    act(() => mockHandlers.get('game-state')?.(snapshot(false)));
    act(() => mockHandlers.get('open-declared')?.({
      declarerSeatId: asSeatId('viewer'),
      hand: ['5♣'],
      valid: false,
      awardedTeam: 1,
    }));

    expect(result.current.notification).toMatchObject({
      message: 'openInvalid:teamBlack',
      type: 'error',
    });
  });
});
