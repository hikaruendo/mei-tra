import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { ChomboReportPanel } from '../ChomboReportPanel';

interface RenderedPanel {
  root: {
    findAllByProps: (props: Record<string, unknown>) => {
      props: Record<string, unknown>;
    }[];
  };
  update: (element: React.ReactElement) => void;
  unmount: () => void;
}

type AlertButton = { text?: string; onPress?: () => void };

const players = [
  { seatId: 'seat-2', name: 'あかり' },
  { seatId: 'seat-3', name: 'ひかる' },
];

async function renderPanel(onReport: jest.Mock, onReported?: jest.Mock) {
  let renderer!: RenderedPanel;
  await act(async () => {
    renderer = TestRenderer.create(
      <ChomboReportPanel
        onReport={onReport}
        onReported={onReported}
        players={players}
      />,
    ) as unknown as RenderedPanel;
  });
  return renderer;
}

function pressable(renderer: RenderedPanel, testID: string) {
  const node = renderer.root
    .findAllByProps({ testID })
    .find((candidate) => typeof candidate.props.onPress === 'function');
  if (!node) throw new Error(`no pressable ${testID}`);
  return node;
}

const press = (renderer: RenderedPanel, testID: string) =>
  act(async () => {
    (pressable(renderer, testID).props.onPress as () => void)();
  });

/** The label a closed dropdown shows for its current choice. */
const shownValue = (renderer: RenderedPanel, dropdown: string) =>
  renderer.root.findAllByProps({ testID: `${dropdown}-value` })[0].props
    .children;

// Each option renders as several nodes, so the options are counted by testID.
const optionIds = (renderer: RenderedPanel, dropdown: string) => [
  ...new Set(
    renderer.root
      .findAllByProps({ accessibilityRole: 'radio' })
      .map((node) => String(node.props.testID))
      .filter((testID) => testID.startsWith(`${dropdown}-`)),
  ),
];

const isSelected = (renderer: RenderedPanel, testID: string) =>
  (
    renderer.root.findAllByProps({ testID, accessibilityRole: 'radio' })[0]
      .props.accessibilityState as { selected: boolean }
  ).selected;

/** Opens a dropdown and picks one of its options. */
const choose = async (renderer: RenderedPanel, dropdown: string, value: string) => {
  await press(renderer, dropdown);
  await press(renderer, `${dropdown}-${value}`);
};

const alertButton = (alertSpy: jest.SpyInstance, text: string) =>
  (alertSpy.mock.calls[0][2] as AlertButton[]).find(
    (button) => button.text === text,
  );

describe('ChomboReportPanel', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('starts closed, on the first player and negri forget', async () => {
    const renderer = await renderPanel(jest.fn());

    expect(shownValue(renderer, 'chombo-report-player')).toBe('あかり');
    expect(shownValue(renderer, 'chombo-report-violation')).toBe('ネグリ忘れ');
    expect(optionIds(renderer, 'chombo-report-player')).toHaveLength(0);
    expect(optionIds(renderer, 'chombo-report-violation')).toHaveLength(0);

    await act(async () => renderer.unmount());
  });

  it('lists the players in a dropdown that closes once one is picked', async () => {
    const renderer = await renderPanel(jest.fn());

    await press(renderer, 'chombo-report-player');
    expect(optionIds(renderer, 'chombo-report-player')).toEqual([
      'chombo-report-player-seat-2',
      'chombo-report-player-seat-3',
    ]);
    expect(isSelected(renderer, 'chombo-report-player-seat-2')).toBe(true);

    await press(renderer, 'chombo-report-player-seat-3');
    expect(optionIds(renderer, 'chombo-report-player')).toHaveLength(0);
    expect(shownValue(renderer, 'chombo-report-player')).toBe('ひかる');

    await act(async () => renderer.unmount());
  });

  it('lists the violations in a dropdown that closes once one is picked', async () => {
    const renderer = await renderPanel(jest.fn());

    await press(renderer, 'chombo-report-violation');
    expect(optionIds(renderer, 'chombo-report-violation')).toHaveLength(4);
    expect(isSelected(renderer, 'chombo-report-violation-negri-forget')).toBe(
      true,
    );

    await press(renderer, 'chombo-report-violation-last-tanzen');
    expect(optionIds(renderer, 'chombo-report-violation')).toHaveLength(0);
    expect(shownValue(renderer, 'chombo-report-violation')).toBe('最後タンツェン');

    await act(async () => renderer.unmount());
  });

  it('keeps only one dropdown open at a time', async () => {
    const renderer = await renderPanel(jest.fn());

    await press(renderer, 'chombo-report-player');
    await press(renderer, 'chombo-report-violation');

    expect(optionIds(renderer, 'chombo-report-player')).toHaveLength(0);
    expect(optionIds(renderer, 'chombo-report-violation')).toHaveLength(4);

    await act(async () => renderer.unmount());
  });

  it('does not report on submit — it only asks about the chosen pair', async () => {
    const onReport = jest.fn();
    const renderer = await renderPanel(onReport);

    await press(renderer, 'chombo-report-submit');

    expect(onReport).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);

    const [, message] = alertSpy.mock.calls[0] as [string, string];
    expect(message).toContain('あかり');
    expect(message).toContain('ネグリ忘れ');

    await act(async () => renderer.unmount());
  });

  it('reports the chosen player and violation once confirmed', async () => {
    const onReport = jest.fn();
    const onReported = jest.fn();
    const renderer = await renderPanel(onReport, onReported);

    await choose(renderer, 'chombo-report-player', 'seat-3');
    await choose(renderer, 'chombo-report-violation', 'wrong-suit');
    await press(renderer, 'chombo-report-submit');

    const [, message] = alertSpy.mock.calls[0] as [string, string];
    expect(message).toContain('ひかる');
    expect(message).toContain('出し方の違反');

    await act(async () => alertButton(alertSpy, '指摘する')?.onPress?.());

    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport).toHaveBeenCalledWith('seat-3', 'wrong-suit');
    expect(onReported).toHaveBeenCalledTimes(1);

    await act(async () => renderer.unmount());
  });

  it('reports nothing when the confirmation is cancelled', async () => {
    const onReport = jest.fn();
    const onReported = jest.fn();
    const renderer = await renderPanel(onReport, onReported);

    await choose(renderer, 'chombo-report-violation', 'four-jack');
    await press(renderer, 'chombo-report-submit');

    const cancel = alertButton(alertSpy, 'キャンセル');
    expect(cancel).toBeDefined();
    await act(async () => cancel?.onPress?.());

    expect(onReport).not.toHaveBeenCalled();
    expect(onReported).not.toHaveBeenCalled();

    await act(async () => renderer.unmount());
  });

  it('falls back to the first player when the chosen one leaves the list', async () => {
    const onReport = jest.fn();
    const renderer = await renderPanel(onReport);

    await choose(renderer, 'chombo-report-player', 'seat-3');
    await act(async () => {
      renderer.update(
        <ChomboReportPanel onReport={onReport} players={[players[0]]} />,
      );
    });

    expect(shownValue(renderer, 'chombo-report-player')).toBe('あかり');
    await press(renderer, 'chombo-report-submit');
    await act(async () => alertButton(alertSpy, '指摘する')?.onPress?.());

    expect(onReport).toHaveBeenCalledWith('seat-2', 'negri-forget');

    await act(async () => renderer.unmount());
  });
});
