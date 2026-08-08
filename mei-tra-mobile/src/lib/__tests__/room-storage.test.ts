import {
  ROOM_RECOVERY_TTL_MS,
  roomStorage,
} from '@/lib/room-storage';

const mockValues = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockValues.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockValues.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockValues.delete(key);
    }),
  },
}));

describe('roomStorage', () => {
  beforeEach(() => mockValues.clear());

  it('stores a bounded recovery record and returns its room id', async () => {
    const savedAt = Date.now();

    await roomStorage.set(' room-1 ', savedAt);

    await expect(roomStorage.getRecord(savedAt + 1)).resolves.toEqual({
      roomId: 'room-1',
      savedAt,
      expiresAt: savedAt + ROOM_RECOVERY_TTL_MS,
    });
    await expect(roomStorage.get()).resolves.toBe('room-1');
  });

  it('removes expired recovery records', async () => {
    await roomStorage.set('room-1', 10_000);

    await expect(
      roomStorage.getRecord(10_000 + ROOM_RECOVERY_TTL_MS),
    ).resolves.toBeNull();
    expect(mockValues.has('meitra.currentRoomRecovery')).toBe(false);
  });

  it('rejects malformed recovery records', async () => {
    mockValues.set(
      'meitra.currentRoomRecovery',
      JSON.stringify({ roomId: 'room-1', expiresAt: 'later' }),
    );

    await expect(roomStorage.getRecord()).resolves.toBeNull();
    expect(mockValues.has('meitra.currentRoomRecovery')).toBe(false);
  });

  it('migrates the legacy room id into a TTL record', async () => {
    mockValues.set('meitra.currentRoomId', 'legacy-room');

    await expect(roomStorage.getRecord(10_000)).resolves.toEqual({
      roomId: 'legacy-room',
      savedAt: 10_000,
      expiresAt: 10_000 + ROOM_RECOVERY_TTL_MS,
    });
    expect(mockValues.has('meitra.currentRoomId')).toBe(false);
  });
});
