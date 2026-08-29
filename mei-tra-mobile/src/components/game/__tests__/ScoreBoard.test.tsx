import React from 'react';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { ScoreBoard } from '../ScoreBoard';

interface RendererHandle {
  root: {
    findAllByProps: (props: Record<string, unknown>) => {
      props: Record<string, unknown>;
    }[];
    findByProps: (props: Record<string, unknown>) => {
      props: Record<string, unknown>;
    };
  };
}

describe('ScoreBoard', () => {
  it('shows canonical team scores around one shared winning target', () => {
    let renderer!: RendererHandle;

    act(() => {
      renderer = TestRenderer.create(
        <ScoreBoard
          pointsToWin={5}
          scores={{
            0: { play: 0, total: 3 },
            1: { play: 0, total: 0 },
          }}
          teamNames={{ 0: '赤組', 1: '黒組' }}
        />,
      ) as unknown as RendererHandle;
    });

    expect(
      renderer.root.findByProps({ testID: 'scoreboard-score-0' }).props
        .children,
    ).toBe(3);
    expect(
      renderer.root.findByProps({ testID: 'scoreboard-score-1' }).props
        .children,
    ).toBe(0);
    expect(
      renderer.root.findByProps({ testID: 'scoreboard-target' }),
    ).toBeDefined();
    expect(
      renderer.root.findByProps({ testID: 'scoreboard-target-text' }).props
        .children,
    ).toBe('5点先取');
    expect(renderer.root.findAllByProps({ children: '3/5' })).toHaveLength(0);
  });

  it('marks only a team exactly one point from victory as reach', () => {
    let renderer!: RendererHandle;

    act(() => {
      renderer = TestRenderer.create(
        <ScoreBoard
          pointsToWin={5}
          scores={{
            0: { play: 0, total: 4 },
            1: { play: 0, total: 5 },
          }}
        />,
      ) as unknown as RendererHandle;
    });

    expect(
      renderer.root.findByProps({ testID: 'scoreboard-status-0' }).props
        .children,
    ).toBe('あと1点');
    expect(
      renderer.root.findAllByProps({ testID: 'scoreboard-status-1' }),
    ).toHaveLength(0);
  });

  it('keeps long team names to one line', () => {
    let renderer!: RendererHandle;

    act(() => {
      renderer = TestRenderer.create(
        <ScoreBoard
          pointsToWin={5}
          scores={{
            0: { play: 0, total: 0 },
            1: { play: 0, total: 0 },
          }}
          teamNames={{ 0: 'とても長い赤チーム名', 1: 'とても長い黒チーム名' }}
        />,
      ) as unknown as RendererHandle;
    });

    expect(
      renderer.root.findByProps({ children: 'とても長い赤チーム名' }).props
        .numberOfLines,
    ).toBe(1);
    expect(
      renderer.root.findByProps({ children: 'とても長い黒チーム名' }).props
        .numberOfLines,
    ).toBe(1);
  });

  it('uses a compact header layout without fixing its height', () => {
    let renderer!: RendererHandle;

    act(() => {
      renderer = TestRenderer.create(
        <ScoreBoard
          pointsToWin={5}
          scores={{
            0: { play: 0, total: 3 },
            1: { play: 0, total: 0 },
          }}
        />,
      ) as unknown as RendererHandle;
    });

    const scoreboardStyle = StyleSheet.flatten(
      renderer.root.findByProps({ testID: 'scoreboard' }).props.style,
    ) as ViewStyle;
    const scoreStyle = StyleSheet.flatten(
      renderer.root.findByProps({ testID: 'scoreboard-score-0' }).props.style,
    ) as TextStyle;

    expect(scoreboardStyle).toMatchObject({ paddingVertical: 3 });
    expect(scoreboardStyle.height).toBeUndefined();
    expect(scoreStyle).toMatchObject({
      marginTop: 5,
      fontSize: 24,
      lineHeight: 27,
    });
  });
});
