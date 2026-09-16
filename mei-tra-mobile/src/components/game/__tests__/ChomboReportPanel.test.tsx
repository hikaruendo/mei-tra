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
  unmount: () => void;
}

type AlertButton = { text?: string; onPress?: () => void };

const players = [
  { seatId: 'seat-2', name: 'あかり' },
  { seatId: 'seat-3', name: 'ひかる' },
];

async function renderPanel(onReport: jest.Mock) {
  let renderer!: RenderedPanel;
  await act(async () => {
    renderer = TestRenderer.create(
      <ChomboReportPanel onReport={onReport} players={players} />,
    ) as unknown as RenderedPanel;
  });
  return renderer;
}

function pressReport(
  renderer: RenderedPanel,
  seatId: string,
  violation: string,
): void {
  const button = renderer.root
    .findAllByProps({ testID: `chombo-report-${seatId}-${violation}` })
    .find((node) => typeof node.props.onPress === 'function');

  if (!button) throw new Error(`no report button for ${seatId}/${violation}`);
  (button.props.onPress as () => void)();
}

describe('ChomboReportPanel', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('does not report on the first tap — it only asks', async () => {
    const onReport = jest.fn();
    const renderer = await renderPanel(onReport);

    await act(async () => {
      pressReport(renderer, 'seat-2', 'negri-forget');
    });

    expect(onReport).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);

    const [, message] = alertSpy.mock.calls[0] as [string, string];
    expect(message).toContain('あかり');
    expect(message).toContain('ネグリ忘れ');

    await act(async () => renderer.unmount());
  });

  it('reports only once the confirm button is pressed', async () => {
    const onReport = jest.fn();
    const renderer = await renderPanel(onReport);

    await act(async () => {
      pressReport(renderer, 'seat-3', 'wrong-suit');
    });

    const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
    const confirm = buttons.find((button) => button.text === '指摘する');

    await act(async () => confirm?.onPress?.());

    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport).toHaveBeenCalledWith('seat-3', 'wrong-suit');

    await act(async () => renderer.unmount());
  });

  it('reports nothing when the confirmation is cancelled', async () => {
    const onReport = jest.fn();
    const renderer = await renderPanel(onReport);

    await act(async () => {
      pressReport(renderer, 'seat-2', 'four-jack');
    });

    const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
    const cancel = buttons.find((button) => button.text === 'キャンセル');

    expect(cancel).toBeDefined();
    await act(async () => cancel?.onPress?.());

    expect(onReport).not.toHaveBeenCalled();

    await act(async () => renderer.unmount());
  });
});
