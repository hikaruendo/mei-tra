import type {
  GameHistoryReplayEventContract,
  GameHistoryReplayViewContract,
} from '@meitra/contracts/game-history';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { GameHistory } from '../GameHistory';

interface RenderedHistory {
  root: {
    findByProps: (props: Record<string, unknown>) => unknown;
    findAllByProps: (props: Record<string, unknown>) => unknown[];
  };
  unmount: () => void;
}

const membershipEvent = (
  actionType: 'player_joined' | 'player_left',
): GameHistoryReplayEventContract =>
  ({
    id: actionType,
    timestamp: '2026-08-30T00:00:00.000Z',
    actionType,
    kind: 'membership',
    actorSeatId: null,
    roundNumber: null,
    gamePhase: null,
    summary: '',
    details: { seatId: null, playerName: 'Player' },
    detailItems: [],
    actionData: {},
  }) as GameHistoryReplayEventContract;

const replay: GameHistoryReplayViewContract = {
  roomId: 'room-1',
  totalEntries: 2,
  rounds: [
    {
      roundNumber: null,
      startedAt: null,
      endedAt: null,
      actionTypes: ['player_joined', 'player_left'],
      actorSeatIds: [],
      entries: [],
      events: [
        membershipEvent('player_joined'),
        membershipEvent('player_left'),
      ],
    },
  ],
};

describe('GameHistory membership events', () => {
  it('keeps membership events visible by default for the live log', async () => {
    let renderer!: RenderedHistory;
    await act(async () => {
      renderer = TestRenderer.create(
        <GameHistory
          error={null}
          loading={false}
          onRefresh={jest.fn()}
          replay={replay}
          summary={null}
        />,
      ) as unknown as RenderedHistory;
    });

    expect(
      renderer.root.findByProps({
        testID: 'game-history-membership-section',
      }),
    ).toBeTruthy();

    await act(async () => renderer.unmount());
  });

  it('hides membership events in profile history', async () => {
    let renderer!: RenderedHistory;
    await act(async () => {
      renderer = TestRenderer.create(
        <GameHistory
          error={null}
          loading={false}
          onRefresh={jest.fn()}
          replay={replay}
          showMembershipEvents={false}
          summary={null}
        />,
      ) as unknown as RenderedHistory;
    });

    expect(
      renderer.root.findAllByProps({
        testID: 'game-history-membership-section',
      }),
    ).toHaveLength(0);

    await act(async () => renderer.unmount());
  });
});
