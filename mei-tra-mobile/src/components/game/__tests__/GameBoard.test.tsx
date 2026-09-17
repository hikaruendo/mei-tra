/* eslint-disable @typescript-eslint/no-require-imports */
import type { MobileGameSnapshot } from '@/types/game';
import { OPEN_MAX_HAND_SIZE } from '@meitra/contracts/game';
import { asSeatId } from '@meitra/contracts/ids';
import React from 'react';
import { AccessibilityInfo, Alert, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { ChomboReportPanel } from '@/components/game/ChomboReportPanel';
import { ChomboScenarioPanel } from '@/components/game/ChomboScenarioPanel';
import { HandFan } from '@/components/game/HandFan';

import { GameBoard } from '../GameBoard';

jest.mock('@/components/game/BlowControls', () => ({
  BlowControls: () => null,
}));
jest.mock('@/components/game/GameHistory', () => ({
  GameHistory: () => null,
}));
jest.mock('@/components/game/PlayerSeat', () => ({
  PlayerSeat: ({ player }: { player: { seatId: string } }) => {
    const ReactModule = require('react') as typeof React;
    const { View } = require('react-native') as typeof import('react-native');
    return ReactModule.createElement(View, {
      testID: `mock-player-seat-${player.seatId}`,
    });
  },
}));
jest.mock('@/components/game/PlayerAvatar', () => ({
  PlayerAvatar: ({ player }: { player: { seatId: string } }) => {
    const ReactModule = require('react') as typeof React;
    const { View } = require('react-native') as typeof import('react-native');
    return ReactModule.createElement(View, {
      testID: `mock-player-avatar-${player.seatId}`,
    });
  },
}));
jest.mock('@/components/game/StartPlayerJanken', () => ({
  StartPlayerJanken: () => null,
}));
jest.mock('@/components/game/MiniCard', () => ({
  MiniCard: () => null,
}));
jest.mock('@/components/game/ScoreBoard', () => ({
  ScoreBoard: () => null,
}));
jest.mock('@/components/social/ChatPanel', () => ({
  ChatPanel: () => null,
}));
jest.mock('@/components/game/DealtCard', () => ({
  DealtCard: ({
    children,
    index,
    reducedMotion,
    seatId,
  }: {
    children: React.ReactNode;
    index: number;
    reducedMotion: boolean | null;
    seatId: string;
  }) => {
    const ReactModule = require('react') as typeof React;
    const { View } = require('react-native') as typeof import('react-native');
    return ReactModule.createElement(
      View,
      {
        accessibilityLabel: String(reducedMotion),
        testID: `mock-dealt-card-${seatId}-${index}`,
      },
      children,
    );
  },
}));
jest.mock('@/components/game/PlayingCard', () => ({
  PlayingCard: (props: Record<string, unknown>) => {
    const ReactModule = require('react') as typeof React;
    const { Pressable } = require('react-native') as typeof import('react-native');
    return ReactModule.createElement(Pressable, {
      ...props,
      testID: `mock-playing-card-${String(props.card)}`,
    });
  },
}));
jest.mock('@/components/ui/Button', () => ({
  Button: (props: Record<string, unknown>) => {
    const ReactModule = require('react') as typeof React;
    const { Pressable } = require('react-native') as typeof import('react-native');
    return ReactModule.createElement(Pressable, props);
  },
}));
jest.mock('@/hooks/useHandFanMetrics', () => ({
  useHandFanMetrics: () => ({ cardWidth: 70, cardMargin: -10 }),
}));

const game: MobileGameSnapshot = {
  roomId: 'room-1',
  players: [
    {
      socketId: 'socket-1',
      seatId: asSeatId('player-1'),
      userId: 'user-1',
      name: 'Player 1',
      team: 0,
      hand: ['S-3', 'H-4'],
      isHost: true,
      isCOM: false,
      hasRequiredBroken: false,
    },
  ],
  gamePhase: 'play',
  currentField: {
    cards: [],
    playedBySeatIds: [],
    baseCard: '',
    dealerSeatId: asSeatId('player-1'),
    isComplete: false,
  },
  currentTurnSeatId: asSeatId('player-1'),
  blowState: {
    currentTrump: 'zuppe',
    currentHighestDeclaration: null,
    declarations: [],
    actionHistory: [],
    lastPasserSeatId: null,
    isRoundCancelled: false,
    currentBlowIndex: 0,
  },
  teamScores: {
    0: { play: 0, total: 0 },
    1: { play: 0, total: 0 },
  },
  youSeatId: asSeatId('player-1'),
  isSpectator: false,
  negriCard: null,
  negriSeatId: null,
  revealedAgari: null,
  fields: [],
  hostSeatId: asSeatId('player-1'),
  pointsToWin: 5,
  paused: false,
  disconnectedSeatIds: [],
  idleSeatIds: [],
};

describe('GameBoard interactions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('plays for a new selection or a different card, but not deselection', async () => {
    const onCardSelection = jest.fn();
    const onCancel = jest.fn();
    let renderer!: {
      root: {
        findByProps: (props: Record<string, unknown>) => {
          props: { onPress?: () => void };
        };
      };
      unmount: () => void;
    };

    await act(async () => {
      renderer = TestRenderer.create(
        <GameBoard
          game={game}
          isHost
          onCardSelection={onCardSelection}
          onCancel={onCancel}
          onDeclare={jest.fn()}
          onLeave={jest.fn()}
          onPass={jest.fn()}
          onPlayCard={jest.fn()}
          onReplaceWithCOM={jest.fn()}
          onSelectBaseSuit={jest.fn()}
          onSelectNegri={jest.fn()}
        />,
      ) as unknown as typeof renderer;
      await Promise.resolve();
    });

    const findCard = (card: string) =>
      renderer.root.findByProps({ testID: `mock-playing-card-${card}` });

    await act(async () => {
      findCard('S-3').props.onPress?.();
    });
    expect(onCardSelection).toHaveBeenCalledTimes(1);

    await act(async () => {
      findCard('S-3').props.onPress?.();
    });
    expect(onCardSelection).toHaveBeenCalledTimes(1);

    await act(async () => {
      findCard('S-3').props.onPress?.();
      findCard('H-4').props.onPress?.();
    });
    expect(onCardSelection).toHaveBeenCalledTimes(3);

    await act(async () => {
      renderer.root.findByProps({ variant: 'secondary' }).props.onPress?.();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.unmount();
    });
  });

  it('keeps player info at its intrinsic height after selecting a card', async () => {
    let renderer!: {
      root: {
        findByProps: (props: Record<string, unknown>) => {
          props: { onPress?: () => void; style?: unknown };
        };
      };
      unmount: () => void;
    };

    await act(async () => {
      renderer = TestRenderer.create(
        <GameBoard
          game={game}
          isHost
          onDeclare={jest.fn()}
          onLeave={jest.fn()}
          onPass={jest.fn()}
          onPlayCard={jest.fn()}
          onReplaceWithCOM={jest.fn()}
          onSelectBaseSuit={jest.fn()}
          onSelectNegri={jest.fn()}
        />,
      ) as unknown as typeof renderer;
      await Promise.resolve();
    });

    await act(async () => {
      renderer.root
        .findByProps({ testID: 'mock-playing-card-S-3' })
        .props.onPress?.();
    });

    const playerInfo = renderer.root.findByProps({
      testID: 'self-player-info',
    });
    expect(StyleSheet.flatten(playerInfo.props.style)).toMatchObject({
      alignSelf: 'flex-start',
    });

    await act(async () => renderer.unmount());
  });

  it('opens and closes the glass options menu from the header control', async () => {
    let renderer!: {
      root: {
        findAllByProps: (props: Record<string, unknown>) => unknown[];
        findByProps: (props: Record<string, unknown>) => {
          props: { onPress?: () => void; style?: unknown };
        };
      };
      unmount: () => void;
    };

    await act(async () => {
      renderer = TestRenderer.create(
        <GameBoard
          game={game}
          isHost
          onDeclare={jest.fn()}
          onLeave={jest.fn()}
          onPass={jest.fn()}
          onPlayCard={jest.fn()}
          onReplaceWithCOM={jest.fn()}
          onSelectBaseSuit={jest.fn()}
          onSelectNegri={jest.fn()}
        />,
      ) as unknown as typeof renderer;
      await Promise.resolve();
    });

    await act(async () => {
      renderer.root
        .findByProps({ testID: 'game-options-trigger' })
        .props.onPress?.();
    });
    expect(
      renderer.root.findByProps({ testID: 'game-options-menu' }),
    ).toBeDefined();
    expect(
      StyleSheet.flatten(
        renderer.root.findByProps({
          testID: 'game-options-trigger-surface',
        }).props.style,
      ),
    ).toMatchObject({ width: 44 });
    expect(
      StyleSheet.flatten(
        renderer.root.findByProps({ testID: 'game-options-close' }).props.style,
      ),
    ).toMatchObject({ width: 44, height: 44 });

    await act(async () => {
      renderer.root
        .findByProps({ testID: 'game-options-close' })
        .props.onPress?.();
    });
    expect(
      renderer.root.findAllByProps({ testID: 'game-options-menu' }),
    ).toHaveLength(0);

    await act(async () => renderer.unmount());
  });

  it('renders a human opponent directly and only offers visible moderation when unavailable', async () => {
    const players = [
      game.players[0],
      ...['player-2', 'player-3', 'player-4'].map((seatId, index) => ({
        ...game.players[0],
        socketId: `socket-${index + 2}`,
        seatId: asSeatId(seatId),
        userId: `user-${index + 2}`,
        name: `Player ${index + 2}`,
        team: ((index + 1) % 2) as 0 | 1,
        isHost: false,
      })),
    ];
    let renderer!: {
      toJSON: () => unknown;
      unmount: () => void;
    };

    await act(async () => {
      renderer = TestRenderer.create(
        <GameBoard
          game={{ ...game, players }}
          isHost
          onDeclare={jest.fn()}
          onLeave={jest.fn()}
          onPass={jest.fn()}
          onPlayCard={jest.fn()}
          onReplaceWithCOM={jest.fn()}
          onSelectBaseSuit={jest.fn()}
          onSelectNegri={jest.fn()}
        />,
      ) as unknown as typeof renderer;
      await Promise.resolve();
    });

    const findByTestId = (
      value: unknown,
      testID: string,
    ): { props?: Record<string, unknown>; children?: unknown[] } | null => {
      if (Array.isArray(value)) {
        for (const child of value) {
          const match = findByTestId(child, testID);
          if (match) return match;
        }
        return null;
      }
      if (!value || typeof value !== 'object') return null;

      const node = value as {
        props?: Record<string, unknown>;
        children?: unknown[];
      };
      if (node.props?.testID === testID) return node;
      return findByTestId(node.children ?? [], testID);
    };
    const opponentSlot = findByTestId(
      renderer.toJSON(),
      'opponent-seat-player-2',
    );
    expect(
      StyleSheet.flatten(opponentSlot?.props?.style as ViewStyle),
    ).toMatchObject({
      flex: 1,
      minWidth: 0,
      maxWidth: 110,
    });
    expect(opponentSlot?.children?.[0]).toMatchObject({
      props: { testID: 'mock-player-seat-player-2' },
    });
    expect(JSON.stringify(renderer.toJSON())).not.toContain('COMに置換');

    await act(async () => renderer.unmount());
    await act(async () => {
      renderer = TestRenderer.create(
        <GameBoard
          game={{
            ...game,
            players,
            disconnectedSeatIds: [asSeatId('player-2')],
          }}
          isHost
          onDeclare={jest.fn()}
          onLeave={jest.fn()}
          onPass={jest.fn()}
          onPlayCard={jest.fn()}
          onReplaceWithCOM={jest.fn()}
          onSelectBaseSuit={jest.fn()}
          onSelectNegri={jest.fn()}
        />,
      ) as unknown as typeof renderer;
      await Promise.resolve();
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('COMに置換');

    await act(async () => renderer.unmount());
  });

  it('tracks reduce-motion changes while the board remains mounted', async () => {
    let reduceMotionHandler: ((enabled: boolean) => void) | null = null;
    const removeListener = jest.fn();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    const addEventListenerSpy = jest.spyOn(
      AccessibilityInfo,
      'addEventListener',
    ) as unknown as jest.SpyInstance<
      { remove: () => void },
      [string, (enabled: boolean) => void]
    >;
    addEventListenerSpy.mockImplementation((event, handler) => {
        if (event === 'reduceMotionChanged') {
          reduceMotionHandler = handler;
        }
        return { remove: removeListener };
      });

    let renderer!: {
      root: {
        findByProps: (props: Record<string, unknown>) => {
          props: { accessibilityLabel?: string };
        };
      };
      unmount: () => void;
    };
    await act(async () => {
      renderer = TestRenderer.create(
        <GameBoard
          game={game}
          isHost
          onDeclare={jest.fn()}
          onLeave={jest.fn()}
          onPass={jest.fn()}
          onPlayCard={jest.fn()}
          onReplaceWithCOM={jest.fn()}
          onSelectBaseSuit={jest.fn()}
          onSelectNegri={jest.fn()}
        />,
      ) as unknown as typeof renderer;
      await Promise.resolve();
    });

    const dealtCard = () =>
      renderer.root.findByProps({
        testID: 'mock-dealt-card-player-1-0',
      });
    expect(dealtCard().props.accessibilityLabel).toBe('false');

    await act(async () => {
      reduceMotionHandler?.(true);
    });
    expect(dealtCard().props.accessibilityLabel).toBe('true');

    await act(async () => renderer.unmount());
    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});

describe('GameBoard field mat', () => {
  it('sizes the cushion box square, from the one place that owns the number', () => {
    // The invariant that replaced the old mismatch: fieldCenter and the mat
    // are the same box, so the artwork can never hang past its parent.
    const { Dimensions } = require('react-native') as typeof import('react-native');
    const {
      computeFieldMatSize,
    } = require('@/hooks/useFieldMatSize') as typeof import('@/hooks/useFieldMatSize');
    const { width, height } = Dimensions.get('window');

    let renderer!: {
      root: { findByProps: (props: Record<string, unknown>) => { props: { style?: unknown } } };
      unmount: () => void;
    };
    act(() => {
      renderer = TestRenderer.create(
        <GameBoard
          game={game}
          isHost
          onDeclare={jest.fn()}
          onLeave={jest.fn()}
          onPass={jest.fn()}
          onPlayCard={jest.fn()}
          onReplaceWithCOM={jest.fn()}
          onSelectBaseSuit={jest.fn()}
          onSelectNegri={jest.fn()}
        />,
      ) as unknown as typeof renderer;
    });

    const style = StyleSheet.flatten(
      renderer.root.findByProps({ testID: 'field-center' }).props.style as ViewStyle,
    ) as ViewStyle;
    const expected = computeFieldMatSize(width, height);
    expect(style.width).toBe(expected);
    expect(style.height).toBe(expected);
    expect(expected).toBeGreaterThan(164);

    act(() => renderer.unmount());
  });
});

describe('GameBoard open action', () => {
  const renderProBoard = (
    handSize: number,
    onDeclareOpen: jest.Mock,
    actionsDisabled = false,
  ) => {
    let renderer!: {
      root: {
        findAllByProps: (props: Record<string, unknown>) => {
          props: Record<string, unknown>;
        }[];
      };
      unmount: () => void;
    };
    act(() => {
      renderer = TestRenderer.create(
        <GameBoard
          game={{
            ...game,
            gameMode: 'pro',
            players: [
              {
                ...game.players[0],
                hand: Array.from({ length: handSize }, (_, index) => 'S-' + String(index + 3)),
              },
            ],
            blowState: {
              ...game.blowState,
              currentHighestDeclaration: {
                seatId: asSeatId('player-1'),
                team: 0,
                trumpType: 'zuppe',
                numberOfPairs: 6,
                timestamp: 1,
              },
            },
          }}
          actionsDisabled={actionsDisabled}
          isHost
          onDeclare={jest.fn()}
          onDeclareOpen={onDeclareOpen}
          onLeave={jest.fn()}
          onPass={jest.fn()}
          onPlayCard={jest.fn()}
          onReplaceWithCOM={jest.fn()}
          onSelectBaseSuit={jest.fn()}
          onSelectNegri={jest.fn()}
        />,
      ) as unknown as typeof renderer;
    });
    return renderer;
  };

  it('offers open only once the player is down to the open hand size', () => {
    const onDeclareOpen = jest.fn();

    const overLimit = renderProBoard(OPEN_MAX_HAND_SIZE + 1, onDeclareOpen);
    expect(overLimit.root.findAllByProps({ testID: 'declare-open' })).toHaveLength(0);
    act(() => overLimit.unmount());

    const atLimit = renderProBoard(OPEN_MAX_HAND_SIZE, onDeclareOpen);
    expect(atLimit.root.findAllByProps({ testID: 'declare-open' }).length).toBeGreaterThan(0);
    act(() => atLimit.unmount());
  });

  it('withholds open while the socket is down', () => {
    const onDeclareOpen = jest.fn();

    const disconnected = renderProBoard(OPEN_MAX_HAND_SIZE, onDeclareOpen, true);
    expect(
      disconnected.root.findAllByProps({ testID: 'declare-open' }),
    ).toHaveLength(0);
    act(() => disconnected.unmount());
  });

  it('asks before opening, and opens only once confirmed', () => {
    type AlertButton = { text?: string; onPress?: () => void };
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    const onDeclareOpen = jest.fn();
    const board = renderProBoard(OPEN_MAX_HAND_SIZE, onDeclareOpen);
    const pressOpen = () =>
      act(() => {
        const button = board.root
          .findAllByProps({ testID: 'declare-open' })
          .find((node) => typeof node.props.onPress === 'function');
        (button?.props.onPress as () => void)();
      });
    const buttonsOf = (call: number) =>
      alertSpy.mock.calls[call][2] as AlertButton[];

    pressOpen();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe('オープンしますか？');
    expect(onDeclareOpen).not.toHaveBeenCalled();

    act(() => buttonsOf(0).find((b) => b.text === 'キャンセル')?.onPress?.());
    expect(onDeclareOpen).not.toHaveBeenCalled();

    pressOpen();
    act(() => buttonsOf(1).find((b) => b.text === 'オープンする')?.onPress?.());
    expect(onDeclareOpen).toHaveBeenCalledTimes(1);

    act(() => board.unmount());
    alertSpy.mockRestore();
  });
});

describe('GameBoard pro drag gating', () => {
  type ProRenderer = {
    root: {
      findAllByProps: (props: Record<string, unknown>) => unknown[];
      findByProps: (props: Record<string, unknown>) => {
        props: {
          scrollEnabled?: boolean;
          onPress?: () => void;
          accessibilityActions?: { name: string }[];
        };
      };
      findByType: (type: typeof HandFan) => {
        props: {
          cards?: string[];
          onDropAction?: (card: string, action: 'play' | 'negri') => void;
          onDragActiveChange?: (active: boolean) => void;
        };
      };
    };
    unmount: () => void;
  };

  const renderProBoard = (
    gamePhase: 'blow' | 'play',
    handlers: { onPlayCard: jest.Mock; onSelectNegri: jest.Mock },
    pendingHandCard: string | null = null,
  ) => {
    let renderer!: ProRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <GameBoard
          game={{
            ...game,
            gameMode: 'pro',
            gamePhase,
            blowState: {
              ...game.blowState,
              currentHighestDeclaration: {
                seatId: asSeatId('player-1'),
                team: 0,
                trumpType: 'zuppe',
                numberOfPairs: 6,
                timestamp: 1,
              },
            },
          }}
          isHost
          onDeclare={jest.fn()}
          onLeave={jest.fn()}
          onPass={jest.fn()}
          onPlayCard={handlers.onPlayCard}
          onReplaceWithCOM={jest.fn()}
          onSelectBaseSuit={jest.fn()}
          onSelectNegri={handlers.onSelectNegri}
          pendingHandCard={pendingHandCard}
        />,
      ) as unknown as ProRenderer;
    });
    return renderer;
  };

  it('leaves a sent card out of the hand until the server answers', () => {
    const handlers = { onPlayCard: jest.fn(), onSelectNegri: jest.fn() };
    const [sent, ...rest] = game.players[0].hand;
    const renderer = renderProBoard('play', handlers, sent);

    expect(renderer.root.findByType(HandFan).props.cards).toEqual(rest);

    act(() => renderer.unmount());
  });

  it('offers no drop target during the blow phase', () => {
    const handlers = { onPlayCard: jest.fn(), onSelectNegri: jest.fn() };
    const renderer = renderProBoard('blow', handlers);

    expect(
      renderer.root.findAllByProps({ testID: 'pro-drop-zones' }),
    ).toHaveLength(0);

    const handFan = renderer.root.findByType(HandFan);
    act(() => {
      handFan.props.onDropAction?.('S-3', 'play');
      handFan.props.onDropAction?.('S-3', 'negri');
    });
    expect(handlers.onPlayCard).not.toHaveBeenCalled();
    expect(handlers.onSelectNegri).not.toHaveBeenCalled();

    act(() => renderer.unmount());
  });

  it('drops to play and to negri during the play phase', () => {
    const handlers = { onPlayCard: jest.fn(), onSelectNegri: jest.fn() };
    const renderer = renderProBoard('play', handlers);

    expect(
      renderer.root.findAllByProps({ testID: 'pro-drop-zones' }).length,
    ).toBeGreaterThan(0);

    const handFan = renderer.root.findByType(HandFan);
    act(() => {
      handFan.props.onDropAction?.('S-3', 'play');
      handFan.props.onDropAction?.('H-4', 'negri');
    });
    expect(handlers.onPlayCard).toHaveBeenCalledWith('S-3');
    expect(handlers.onSelectNegri).toHaveBeenCalledWith('H-4');

    act(() => renderer.unmount());
  });

  it('offers the same pro moves to a screen reader as to the drag', () => {
    const handlers = { onPlayCard: jest.fn(), onSelectNegri: jest.fn() };
    const renderer = renderProBoard('play', handlers);
    const card = () =>
      renderer.root.findByProps({ testID: 'mock-playing-card-S-3' }).props as {
        accessibilityActions?: { name: string }[];
        onAccessibilityAction?: (actionName: string) => void;
      };

    expect(card().accessibilityActions?.map((action) => action.name)).toEqual([
      'play',
      'negri',
    ]);

    act(() => card().onAccessibilityAction?.('play'));
    act(() => card().onAccessibilityAction?.('negri'));
    expect(handlers.onPlayCard).toHaveBeenCalledWith('S-3');
    expect(handlers.onSelectNegri).toHaveBeenCalledWith('S-3');

    act(() => renderer.unmount());
  });

  it('offers no pro moves during the blow phase', () => {
    const handlers = { onPlayCard: jest.fn(), onSelectNegri: jest.fn() };
    const renderer = renderProBoard('blow', handlers);

    expect(
      renderer.root.findByProps({ testID: 'mock-playing-card-S-3' }).props
        .accessibilityActions,
    ).toBeUndefined();

    act(() => renderer.unmount());
  });

  it('leaves tapping out, so no play or cancel button can appear', () => {
    const handlers = { onPlayCard: jest.fn(), onSelectNegri: jest.fn() };
    const renderer = renderProBoard('play', handlers);

    expect(
      renderer.root.findByProps({ testID: 'mock-playing-card-S-3' }).props
        .onPress,
    ).toBeUndefined();

    act(() => renderer.unmount());
  });

  it('stops the board scrolling while a card is held', () => {
    const handlers = { onPlayCard: jest.fn(), onSelectNegri: jest.fn() };
    const renderer = renderProBoard('play', handlers);
    const scrollEnabled = () =>
      renderer.root.findByProps({ testID: 'game-board-scroll' }).props
        .scrollEnabled;

    expect(scrollEnabled()).toBe(true);

    const handFan = renderer.root.findByType(HandFan);
    act(() => handFan.props.onDragActiveChange?.(true));
    expect(scrollEnabled()).toBe(false);

    act(() => handFan.props.onDragActiveChange?.(false));
    expect(scrollEnabled()).toBe(true);

    act(() => renderer.unmount());
  });
});

describe('GameBoard chombo sheet', () => {
  type ChomboRenderer = {
    root: {
      findAllByProps: (props: Record<string, unknown>) => {
        props: { onPress?: () => void };
      }[];
      findAllByType: (
        type: typeof ChomboReportPanel | typeof ChomboScenarioPanel,
      ) => { props: { players?: { seatId: string }[] } }[];
    };
    unmount: () => void;
  };

  const players = [
    game.players[0],
    ...['player-2', 'player-3', 'player-4'].map((seatId, index) => ({
      ...game.players[0],
      socketId: `socket-${index + 2}`,
      seatId: asSeatId(seatId),
      userId: `user-${index + 2}`,
      name: `Player ${index + 2}`,
      team: ((index + 1) % 2) as 0 | 1,
      isHost: false,
      isCOM: seatId === 'player-3',
    })),
  ];

  const renderChomboBoard = (
    overrides: Partial<MobileGameSnapshot>,
    onSetupChomboScenario?: jest.Mock,
  ) => {
    let renderer!: ChomboRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <GameBoard
          game={{ ...game, gameMode: 'pro', players, ...overrides }}
          isHost
          onDeclare={jest.fn()}
          onLeave={jest.fn()}
          onPass={jest.fn()}
          onPlayCard={jest.fn()}
          onReplaceWithCOM={jest.fn()}
          onReportChombo={jest.fn()}
          onSetupChomboScenario={onSetupChomboScenario}
          onSelectBaseSuit={jest.fn()}
          onSelectNegri={jest.fn()}
        />,
      ) as unknown as ChomboRenderer;
    });
    return renderer;
  };

  const press = (renderer: ChomboRenderer, testID: string) => {
    const node = renderer.root
      .findAllByProps({ testID })
      .find((candidate) => typeof candidate.props.onPress === 'function');
    if (!node) throw new Error(`no pressable ${testID}`);
    act(() => node.props.onPress?.());
  };

  const chomboMenuItems = (renderer: ChomboRenderer) =>
    renderer.root.findAllByProps({ testID: 'game-options-chombo' });

  it('keeps the report off the board until the options menu opens it', () => {
    const renderer = renderChomboBoard({});

    expect(renderer.root.findAllByType(ChomboReportPanel)).toHaveLength(0);

    press(renderer, 'game-options-trigger');
    press(renderer, 'game-options-chombo');

    const panels = renderer.root.findAllByType(ChomboReportPanel);
    expect(panels).toHaveLength(1);
    // COM seats cannot be reported, and nobody reports themselves.
    const targets = panels[0].props.players?.map((player) => player.seatId);
    expect(targets).toEqual(expect.arrayContaining(['player-2', 'player-4']));
    expect(targets).not.toContain('player-3');
    expect(targets).not.toContain('player-1');

    act(() => renderer.unmount());
  });

  it('offers no chombo entry outside pro mode', () => {
    const renderer = renderChomboBoard({ gameMode: 'normal' }, jest.fn());

    press(renderer, 'game-options-trigger');
    expect(chomboMenuItems(renderer)).toHaveLength(0);

    act(() => renderer.unmount());
  });

  it('offers the development scenarios in the blow phase and closes after a pick', () => {
    const onSetupChomboScenario = jest.fn();
    const renderer = renderChomboBoard(
      { gamePhase: 'blow' },
      onSetupChomboScenario,
    );

    press(renderer, 'game-options-trigger');
    press(renderer, 'game-options-chombo');

    expect(renderer.root.findAllByType(ChomboReportPanel)).toHaveLength(0);
    expect(renderer.root.findAllByType(ChomboScenarioPanel)).toHaveLength(1);

    press(renderer, 'chombo-scenario-four-jack');

    expect(onSetupChomboScenario).toHaveBeenCalledWith('four-jack');
    expect(renderer.root.findAllByType(ChomboScenarioPanel)).toHaveLength(0);

    act(() => renderer.unmount());
  });

  it('has nothing to open in the blow phase without the development handler', () => {
    const renderer = renderChomboBoard({ gamePhase: 'blow' });

    press(renderer, 'game-options-trigger');
    expect(chomboMenuItems(renderer)).toHaveLength(0);

    act(() => renderer.unmount());
  });
});

describe('GameBoard broken hand action', () => {
  const renderBlowBoard = (
    gameMode: 'normal' | 'pro',
    onRevealBrokenHand: jest.Mock,
    selfFlags: {
      hasBroken?: boolean;
      hasRequiredBroken?: boolean;
      isPasser?: boolean;
    } = { hasRequiredBroken: true },
    blowState: Partial<MobileGameSnapshot['blowState']> = {},
  ) => {
    let renderer!: {
      root: { findAllByProps: (props: Record<string, unknown>) => unknown[] };
      unmount: () => void;
    };
    act(() => {
      renderer = TestRenderer.create(
        <GameBoard
          game={{
            ...game,
            gameMode,
            gamePhase: 'blow',
            blowState: { ...game.blowState, ...blowState },
            players: [{ ...game.players[0], ...selfFlags }],
          }}
          isHost
          onDeclare={jest.fn()}
          onRevealBrokenHand={onRevealBrokenHand}
          onLeave={jest.fn()}
          onPass={jest.fn()}
          onPlayCard={jest.fn()}
          onReplaceWithCOM={jest.fn()}
          onSelectBaseSuit={jest.fn()}
          onSelectNegri={jest.fn()}
        />,
      ) as unknown as typeof renderer;
    });
    return renderer;
  };

  it('hides the broken hand action once the player has bid or passed', () => {
    const onRevealBrokenHand = jest.fn();

    const passedBoard = renderBlowBoard('pro', onRevealBrokenHand, {
      hasBroken: true,
      isPasser: true,
    });
    expect(
      passedBoard.root.findAllByProps({ onPress: onRevealBrokenHand }),
    ).toHaveLength(0);
    act(() => passedBoard.unmount());

    const declaredBoard = renderBlowBoard(
      'pro',
      onRevealBrokenHand,
      { hasBroken: true },
      {
        declarations: [
          {
            seatId: asSeatId('player-1'),
            trumpType: 'herz',
            numberOfPairs: 6,
            timestamp: 1,
          },
        ],
      },
    );
    expect(
      declaredBoard.root.findAllByProps({ onPress: onRevealBrokenHand }),
    ).toHaveLength(0);
    act(() => declaredBoard.unmount());
  });

  it('offers a manual four-jack reveal only in pro mode', () => {
    const onRevealBrokenHand = jest.fn();

    const proBoard = renderBlowBoard('pro', onRevealBrokenHand);
    expect(
      proBoard.root.findAllByProps({ onPress: onRevealBrokenHand }).length,
    ).toBeGreaterThan(0);
    act(() => proBoard.unmount());

    const normalBoard = renderBlowBoard('normal', onRevealBrokenHand);
    expect(
      normalBoard.root.findAllByProps({ onPress: onRevealBrokenHand }),
    ).toHaveLength(0);
    act(() => normalBoard.unmount());
  });

  it.each(['normal', 'pro'] as const)(
    'offers the broken hand action only for a broken hand in %s mode',
    (gameMode) => {
      const onRevealBrokenHand = jest.fn();

      const plainBoard = renderBlowBoard(gameMode, onRevealBrokenHand, {});
      expect(
        plainBoard.root.findAllByProps({ onPress: onRevealBrokenHand }),
      ).toHaveLength(0);
      act(() => plainBoard.unmount());

      const brokenBoard = renderBlowBoard(gameMode, onRevealBrokenHand, {
        hasBroken: true,
      });
      expect(
        brokenBoard.root.findAllByProps({ onPress: onRevealBrokenHand }).length,
      ).toBeGreaterThan(0);
      act(() => brokenBoard.unmount());
    },
  );
});
