import type { GatewayAck } from '@meitra/contracts/socket';

import { emitWithAck, type MobileSocket } from '../realtime';

describe('emitWithAck', () => {
  it('keeps the timed socket as emit receiver', async () => {
    const receiver = Symbol('timed-socket');
    const timedSocket = {
      receiver,
      emit(
        this: { receiver: symbol },
        _event: string,
        _payload: unknown,
        callback: (timeoutError: Error | null, response?: GatewayAck) => void,
      ) {
        if (this.receiver !== receiver) {
          throw new Error('emit receiver was lost');
        }

        callback(null, { success: true });
        return this;
      },
    };
    const socket = {
      connected: true,
      timeout: jest.fn(() => timedSocket),
    };

    await expect(
      emitWithAck(
        socket as unknown as MobileSocket,
        'create-room',
        {
          name: 'test-room',
          pointsToWin: 5,
          teamAssignmentMethod: 'random',
        },
      ),
    ).resolves.toEqual({ success: true });
    expect(socket.timeout).toHaveBeenCalledWith(15000);
  });

  it('maps an acknowledgement timeout to the gateway error response', async () => {
    const timedSocket = {
      emit(
        _event: string,
        _payload: unknown,
        callback: (timeoutError: Error | null) => void,
      ) {
        callback(new Error('ack timeout'));
        return this;
      },
    };
    const socket = {
      connected: true,
      timeout: jest.fn(() => timedSocket),
    };

    await expect(
      emitWithAck(
        socket as unknown as MobileSocket,
        'create-room',
        {
          name: 'test-room',
          pointsToWin: 5,
          teamAssignmentMethod: 'random',
        },
        1000,
      ),
    ).resolves.toEqual({
      success: false,
      error: 'サーバーから応答がありません',
    });
    expect(socket.timeout).toHaveBeenCalledWith(1000);
  });
});
