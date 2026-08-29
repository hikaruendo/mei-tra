/* eslint-disable @typescript-eslint/no-require-imports */
import type { MobileGameSnapshot } from '@/types/game';
import { asSeatId } from '@meitra/contracts/ids';
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

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
