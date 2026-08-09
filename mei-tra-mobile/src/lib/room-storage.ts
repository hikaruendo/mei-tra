import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RoomRecoveryRecord {
  roomId: string;
  savedAt: number;
  expiresAt: number;
}

export const ROOM_RECOVERY_TTL_MS = 24 * 60 * 60 * 1000;

const ROOM_RECOVERY_KEY = 'meitra.currentRoomRecovery';
const LEGACY_ROOM_ID_KEY = 'meitra.currentRoomId';

const isValidRecord = (value: unknown): value is RoomRecoveryRecord => {
  if (!value || typeof value !== 'object') return false;

  const record = value as Partial<RoomRecoveryRecord>;
  return (
    typeof record.roomId === 'string' &&
    record.roomId.trim().length > 0 &&
    typeof record.savedAt === 'number' &&
    Number.isFinite(record.savedAt) &&
    typeof record.expiresAt === 'number' &&
    Number.isFinite(record.expiresAt) &&
    record.expiresAt > record.savedAt
  );
};

const removeInvalidRecord = async () => {
  await AsyncStorage.removeItem(ROOM_RECOVERY_KEY).catch(() => undefined);
};

const createRecord = (roomId: string, savedAt: number): RoomRecoveryRecord => ({
  roomId: roomId.trim(),
  savedAt,
  expiresAt: savedAt + ROOM_RECOVERY_TTL_MS,
});

export const roomStorage = {
  async getRecord(now = Date.now()): Promise<RoomRecoveryRecord | null> {
    try {
      const raw = await AsyncStorage.getItem(ROOM_RECOVERY_KEY);
      if (!raw) {
        const legacyRoomId = await AsyncStorage.getItem(LEGACY_ROOM_ID_KEY);
        if (!legacyRoomId?.trim()) return null;

        const migratedRecord = createRecord(legacyRoomId, now);
        const migrated = await roomStorage.set(legacyRoomId, now);
        if (!migrated) return null;

        await AsyncStorage.removeItem(LEGACY_ROOM_ID_KEY).catch(
          () => undefined,
        );
        return migratedRecord;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }

      if (!isValidRecord(parsed)) {
        await removeInvalidRecord();
        return null;
      }

      if (parsed.expiresAt <= now) {
        await removeInvalidRecord();
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  },

  async get(): Promise<string | null> {
    return (await roomStorage.getRecord())?.roomId ?? null;
  },

  async set(roomId: string, now = Date.now()): Promise<boolean> {
    const normalizedRoomId = roomId.trim();
    if (!normalizedRoomId) return false;

    const record = createRecord(normalizedRoomId, now);

    try {
      await AsyncStorage.setItem(ROOM_RECOVERY_KEY, JSON.stringify(record));
      return true;
    } catch {
      return false;
    }
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(ROOM_RECOVERY_KEY).catch(() => undefined);
  },
};
