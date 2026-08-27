/* eslint-disable @typescript-eslint/no-require-imports */
import type { MobileGameSnapshot } from '@/types/game';
import { asSeatId } from '@meitra/contracts/ids';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { GameBoard } from '../GameBoard';

jest.mock('@/components/game/BlowControls', () => ({
  BlowControls: () => null,
}));
jest.mock('@/components/game/GameHistory', () => ({
  GameHistory: () => null,
}));
jest.mock('@/components/game/PlayerSeat', () => ({
  PlayerSeat: () => null,
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
  DealtCard: ({ children }: { children: React.ReactNode }) => children,
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

describe('GameBoard card interaction sounds', () => {
  it('plays for a new selection or a different card, but not deselection', async () => {
    const onCardInteraction = jest.fn();
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
          gameOver={null}
          isHost
          onCardInteraction={onCardInteraction}
          onCloseGameOver={jest.fn()}
          onDeclare={jest.fn()}
          onLeave={jest.fn()}
          onPass={jest.fn()}
          onPlayCard={jest.fn()}
          onRemovePlayer={jest.fn()}
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
    expect(onCardInteraction).toHaveBeenCalledTimes(1);

    await act(async () => {
      findCard('S-3').props.onPress?.();
    });
    expect(onCardInteraction).toHaveBeenCalledTimes(1);

    await act(async () => {
      findCard('S-3').props.onPress?.();
      findCard('H-4').props.onPress?.();
    });
    expect(onCardInteraction).toHaveBeenCalledTimes(3);

    await act(async () => {
      renderer.unmount();
    });
  });
});
