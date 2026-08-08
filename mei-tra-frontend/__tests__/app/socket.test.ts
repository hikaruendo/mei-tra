import { io } from 'socket.io-client';
import {
  disconnectSocket,
  getExistingSocket,
  getSocket,
  setSocketAuthTokenProvider,
} from '@/app/socket';

type SocketAuthPayload = { roomId: string; token?: string };
type SocketOptions = {
  auth: (callback: (data: SocketAuthPayload) => void) => Promise<void>;
};
type MockSocket = {
  on: jest.Mock;
};

const mockedIo = io as jest.Mock;

describe('game socket authentication', () => {
  beforeEach(() => {
    disconnectSocket();
    mockedIo.mockClear();
    sessionStorage.clear();
  });

  afterEach(() => {
    disconnectSocket();
    setSocketAuthTokenProvider(undefined);
  });

  it('fetches the latest access token for the Socket.IO auth callback', async () => {
    const getAccessToken = jest.fn().mockResolvedValue('fresh-token');

    sessionStorage.setItem('roomId', 'room-1');
    setSocketAuthTokenProvider(getAccessToken);
    getSocket('stale-token');

    const options = mockedIo.mock.calls[0][1] as SocketOptions;
    const callback = jest.fn();
    await options.auth(callback);

    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      roomId: 'room-1',
      token: 'fresh-token',
    });
  });

  it('reuses one browser socket across callers', () => {
    const firstSocket = getSocket('first-token');
    const secondSocket = getSocket('second-token');

    expect(secondSocket).toBe(firstSocket);
    expect(getExistingSocket()).toBe(firstSocket);
    expect(mockedIo).toHaveBeenCalledTimes(1);
  });

  it('does not crash when transport metadata is unavailable on connect', () => {
    getSocket('token');
    const mockSocket = mockedIo.mock.results[0].value as MockSocket;
    const connectHandler = mockSocket.on.mock.calls.find(
      ([event]) => event === 'connect',
    )?.[1] as (() => void) | undefined;

    expect(connectHandler).toBeDefined();
    expect(() => connectHandler?.()).not.toThrow();
  });

  it('clears the browser socket when disconnected', () => {
    const currentSocket = getSocket('token');

    disconnectSocket();

    expect(currentSocket.disconnect).toHaveBeenCalledTimes(1);
    expect(getExistingSocket()).toBeNull();
  });
});
