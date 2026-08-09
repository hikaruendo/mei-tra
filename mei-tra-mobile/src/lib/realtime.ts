import type {
  AckableClientEvent,
  ClientAckPayloads,
  ClientAckResponses,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@meitra/contracts/socket';
import type { Socket } from 'socket.io-client';

export type MobileSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type TimedAckEmit<TEvent extends AckableClientEvent> = (
  event: TEvent,
  payload: ClientAckPayloads[TEvent],
  callback: (
    timeoutError: Error | null,
    response?: ClientAckResponses[TEvent],
  ) => void,
) => MobileSocket;

export const emitWithAck = <TEvent extends AckableClientEvent>(
  socket: MobileSocket | null,
  event: TEvent,
  payload: ClientAckPayloads[TEvent],
  timeoutMs = 15000,
): Promise<ClientAckResponses[TEvent]> =>
  new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({
        success: false,
        error: 'サーバーに接続されていません',
      } as ClientAckResponses[TEvent]);
      return;
    }

    const timedSocket = socket.timeout(timeoutMs);
    const emit = timedSocket.emit.bind(timedSocket) as TimedAckEmit<TEvent>;

    emit(event, payload, (timeoutError, response) => {
      if (timeoutError) {
        resolve({
          success: false,
          error: 'サーバーから応答がありません',
        } as ClientAckResponses[TEvent]);
        return;
      }

      resolve(
        response ??
          ({
            success: true,
          } as ClientAckResponses[TEvent]),
      );
    });
  });
