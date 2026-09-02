import { act, fireEvent, render, screen } from '@testing-library/react';

import { Notification } from '@/components/shared/Notification';

describe('Notification', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a recovery notice visible until it is dismissed', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();

    render(
      <Notification
        closeLabel="通知を閉じる"
        message="場の状態を復旧しました"
        onClose={onClose}
        persistent
        type="warning"
      />,
    );

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '通知を閉じる' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
