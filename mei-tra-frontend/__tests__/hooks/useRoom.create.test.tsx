import { act, renderHook } from '@testing-library/react';
import type { RoomContract } from '@meitra/contracts/room';

import { useRoom } from '@/hooks/useRoom';

const mockSocket = {
  connected: true,
  id: 'socket-1',
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  timeout: jest.fn(),
};

jest.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({ socket: mockSocket, isConnected: true, isConnecting: false }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  mockSocket.timeout.mockReturnValue(mockSocket);
});

it('resolves a successful create acknowledgement with the new room', async () => {
  const room = {
    id: 'room-1',
    name: 'Test room',
    hostSeatId: 'seat-1',
    status: 'waiting',
    players: [],
    settings: {
      maxPlayers: 4,
      isPrivate: false,
      password: null,
      teamAssignmentMethod: 'random',
      pointsToWin: 5,
      allowSpectators: true,
      gameMode: 'pro',
    },
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
    lastActivityAt: '2026-10-18T00:00:00.000Z',
  } as RoomContract;
  mockSocket.emit.mockImplementation((event, _payload, callback) => {
    if (event === 'create-room') callback(null, { success: true, room });
  });
  const { result } = renderHook(() => useRoom());

  let created = false;
  await act(async () => { created = await result.current.createRoom('Test room', 5, 'random', 'pro'); });

  expect(created).toBe(true);
  expect(mockSocket.timeout).toHaveBeenCalledWith(15_000);
  expect(mockSocket.emit).toHaveBeenCalledWith('create-room', {
    name: 'Test room', pointsToWin: 5, teamAssignmentMethod: 'random', gameMode: 'pro',
  }, expect.any(Function));
  expect(result.current.currentRoom?.id).toBe('room-1');
});

it('releases the create action after an acknowledgement timeout', async () => {
  mockSocket.emit.mockImplementation((event, _payload, callback) => {
    if (event === 'create-room') callback(new Error('timeout'));
  });
  const { result } = renderHook(() => useRoom());

  let created = true;
  await act(async () => { created = await result.current.createRoom('Test room', 5, 'random'); });

  expect(created).toBe(false);
  expect(result.current.error).toBe('Room creation timed out');
});
