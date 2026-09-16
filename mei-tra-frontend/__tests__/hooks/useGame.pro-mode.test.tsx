import { act, renderHook } from '@testing-library/react';
import type { GameStatePayload } from '@contracts/game';
import { asSeatId } from '@contracts/ids';
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
const mockTranslate = (key: string) => key;
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
    ['pro', 'negriPromptPro'],
    ['normal', 'negriPrompt'],
  ] as const)('shows the %s-mode prompt instead of the server text when the Agari is revealed', (gameMode, key) => {
    const { result } = renderHook(() => useGame());
    act(() => mockHandlers.get('game-state')?.({ ...snapshot(false), gameMode }));
    act(() => mockHandlers.get('reveal-agari')?.({
      agari: 'A♠',
      message: 'Select a card from your hand as Negri',
      seatId: asSeatId('viewer'),
    }));

    expect(result.current.notification?.message).toBe(key);
  });
});
