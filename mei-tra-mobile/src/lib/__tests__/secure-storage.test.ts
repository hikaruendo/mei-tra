import { secureStorage } from '@/lib/secure-storage';

const mockAsyncValues = new Map<string, string>();
const mockSecureValues = new Map<string, string>();
let mockKeyCounter = 0;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockAsyncValues.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockAsyncValues.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockAsyncValues.delete(key);
    }),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureValues.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureValues.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureValues.delete(key);
  }),
}));

jest.mock('expo-crypto', () => {
  class MockEncryptionKey {
    private readonly keyValue: string;

    constructor(keyValue: string) {
      this.keyValue = keyValue;
    }

    async encoded() {
      return this.keyValue;
    }
  }

  return {
    AESEncryptionKey: {
      generate: jest.fn(async () => {
        mockKeyCounter += 1;
        return new MockEncryptionKey(`key-${mockKeyCounter}`);
      }),
      import: jest.fn(async (value: string) => new MockEncryptionKey(value)),
    },
    AESSealedData: {
      fromCombined: (bytes: Uint8Array) => ({
        value: new TextDecoder().decode(bytes),
      }),
    },
    aesEncryptAsync: jest.fn(
      async (plaintext: string, key: MockEncryptionKey) => ({
        combined: async () =>
          new TextEncoder().encode(`${await key.encoded()}:${plaintext}`),
      }),
    ),
    aesDecryptAsync: jest.fn(async (sealedData: { value: string }) =>
      sealedData.value.slice(sealedData.value.indexOf(':') + 1),
    ),
  };
});

describe('LargeSecureStore', () => {
  beforeEach(() => {
    mockAsyncValues.clear();
    mockSecureValues.clear();
    mockKeyCounter = 0;
    jest.clearAllMocks();
  });

  it('stores large values in AsyncStorage and keeps only the key in SecureStore', async () => {
    const value = 'セッション'.repeat(1200);

    await secureStorage.setItem('auth-token', value);

    expect(mockAsyncValues.get('auth-token')).toBeDefined();
    expect(mockSecureValues.get('auth-token.encryption-key')).toBe('key-1');
    expect(mockSecureValues.has('auth-token')).toBe(false);
    await expect(secureStorage.getItem('auth-token')).resolves.toBe(value);
  });

  it('migrates the previous SecureStore-only value', async () => {
    mockSecureValues.set('legacy-auth', 'legacy session');

    await expect(secureStorage.getItem('legacy-auth')).resolves.toBe(
      'legacy session',
    );
    expect(mockAsyncValues.has('legacy-auth')).toBe(true);
    expect(mockSecureValues.has('legacy-auth')).toBe(false);
    expect(mockSecureValues.has('legacy-auth.encryption-key')).toBe(true);
  });

  it('clears an unreadable encrypted value instead of returning corrupted data', async () => {
    mockAsyncValues.set('broken-auth', 'not-encrypted');

    await expect(secureStorage.getItem('broken-auth')).resolves.toBeNull();
    expect(mockAsyncValues.has('broken-auth')).toBe(false);
  });

  it('removes both encrypted data and its key', async () => {
    await secureStorage.setItem('auth-token', 'session');
    await secureStorage.removeItem('auth-token');

    expect(mockAsyncValues.has('auth-token')).toBe(false);
    expect(mockSecureValues.has('auth-token.encryption-key')).toBe(false);
  });
});
