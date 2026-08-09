import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const ENCRYPTION_KEY_SUFFIX = '.encryption-key';
const LEGACY_CHUNK_SUFFIX = '.chunk.';
const LEGACY_COUNT_SUFFIX = '.chunks';
const BASE64_CHUNK_SIZE = 0x8000;

const encryptionKeyName = (key: string) => `${key}${ENCRYPTION_KEY_SUFFIX}`;
const legacyChunkKey = (key: string, index: number) =>
  `${key}${LEGACY_CHUNK_SUFFIX}${index}`;
const legacyCountKey = (key: string) => `${key}${LEGACY_COUNT_SUFFIX}`;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const encodePlaintext = (value: string): string =>
  bytesToBase64(new TextEncoder().encode(value));

const decodePlaintext = (value: string): string =>
  new TextDecoder().decode(base64ToBytes(value));

const keyCreationPromises = new Map<string, Promise<AESEncryptionKey>>();

const getOrCreateEncryptionKey = async (key: string) => {
  const existingPromise = keyCreationPromises.get(key);
  if (existingPromise) return existingPromise;

  const creationPromise = (async () => {
    const keyName = encryptionKeyName(key);
    const encodedKey = await SecureStore.getItemAsync(keyName);
    if (encodedKey) {
      return AESEncryptionKey.import(encodedKey, 'hex');
    }

    const encryptionKey = await AESEncryptionKey.generate(256);
    await SecureStore.setItemAsync(
      keyName,
      await encryptionKey.encoded('hex'),
    );
    return encryptionKey;
  })();

  keyCreationPromises.set(key, creationPromise);
  try {
    return await creationPromise;
  } finally {
    keyCreationPromises.delete(key);
  }
};

const readLegacyValue = async (key: string): Promise<string | null> => {
  const rawCount = await SecureStore.getItemAsync(legacyCountKey(key));
  if (rawCount) {
    const count = Number(rawCount);
    if (Number.isInteger(count) && count > 0) {
      const chunks = await Promise.all(
        Array.from({ length: count }, (_, index) =>
          SecureStore.getItemAsync(legacyChunkKey(key, index)),
        ),
      );

      if (chunks.every((chunk): chunk is string => chunk !== null)) {
        return chunks.join('');
      }
    }
  }

  return SecureStore.getItemAsync(key);
};

const removeLegacyValue = async (key: string): Promise<void> => {
  const rawCount = await SecureStore.getItemAsync(legacyCountKey(key));
  const count = rawCount ? Number(rawCount) : 0;

  await SecureStore.deleteItemAsync(key);
  await SecureStore.deleteItemAsync(legacyCountKey(key));

  if (Number.isInteger(count) && count > 0) {
    await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(legacyChunkKey(key, index)),
      ),
    );
  }
};

const discardCorruptValue = async (key: string): Promise<void> => {
  await Promise.all([
    AsyncStorage.removeItem(key),
    SecureStore.deleteItemAsync(encryptionKeyName(key)),
  ]).catch(() => undefined);
};

export class LargeSecureStore {
  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);

    if (encrypted === null) {
      const legacy = await readLegacyValue(key);
      if (legacy === null) return null;

      await this.setItem(key, legacy);
      await removeLegacyValue(key);
      return legacy;
    }

    try {
      const encryptionKeyHex = await SecureStore.getItemAsync(
        encryptionKeyName(key),
      );
      if (!encryptionKeyHex) {
        await discardCorruptValue(key);
        return null;
      }

      const encryptionKey = await AESEncryptionKey.import(
        encryptionKeyHex,
        'hex',
      );
      const sealedData = AESSealedData.fromCombined(base64ToBytes(encrypted));
      const plaintext = await aesDecryptAsync(sealedData, encryptionKey, {
        output: 'base64',
      });

      return decodePlaintext(plaintext as string);
    } catch {
      await discardCorruptValue(key);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = await getOrCreateEncryptionKey(key);
    const sealedData = await aesEncryptAsync(
      encodePlaintext(value),
      encryptionKey,
    );
    const encrypted = bytesToBase64(await sealedData.combined());

    await AsyncStorage.setItem(key, encrypted);
    await removeLegacyValue(key);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(encryptionKeyName(key));
    await removeLegacyValue(key);
  }
}

export const secureStorage = new LargeSecureStore();
