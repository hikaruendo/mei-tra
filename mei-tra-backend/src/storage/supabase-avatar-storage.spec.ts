import { SupabaseService } from '../database/supabase.service';
import { SupabaseAvatarStorage } from './supabase-avatar-storage';

describe('SupabaseAvatarStorage', () => {
  const createStorage = (overrides: Record<string, jest.Mock> = {}) => {
    const bucket = {
      upload: overrides.upload ?? jest.fn().mockResolvedValue({ error: null }),
      getPublicUrl:
        overrides.getPublicUrl ??
        jest.fn().mockReturnValue({
          data: { publicUrl: 'https://example.test/avatar.webp' },
        }),
      remove: overrides.remove ?? jest.fn().mockResolvedValue({ error: null }),
      list:
        overrides.list ??
        jest.fn().mockResolvedValue({
          data: [{ name: 'avatar.webp' }, { name: '' }],
          error: null,
        }),
    };
    const from = jest.fn().mockReturnValue(bucket);
    const storage = new SupabaseAvatarStorage({
      client: { storage: { from } },
    } as unknown as SupabaseService);

    return { storage, bucket, from };
  };

  it('uploads to the avatars bucket with the requested metadata', async () => {
    const { storage, bucket, from } = createStorage();
    const data = Buffer.from('avatar');
    const options = {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: false,
    };

    await storage.upload('user-1/avatar.webp', data, options);

    expect(from).toHaveBeenCalledWith('avatars');
    expect(bucket.upload).toHaveBeenCalledWith(
      'user-1/avatar.webp',
      data,
      options,
    );
  });

  it('returns listed object names and hides Supabase response objects', async () => {
    const { storage, bucket } = createStorage();

    await expect(
      storage.list('user-1', { limit: 100, offset: 200 }),
    ).resolves.toEqual(['avatar.webp']);
    expect(bucket.list).toHaveBeenCalledWith('user-1', {
      limit: 100,
      offset: 200,
    });
  });

  it('throws provider errors instead of leaking response branching to callers', async () => {
    const providerError = new Error('storage unavailable');
    const { storage } = createStorage({
      remove: jest.fn().mockResolvedValue({ error: providerError }),
    });

    await expect(storage.remove(['user-1/avatar.webp'])).rejects.toBe(
      providerError,
    );
  });

  it('resolves public URLs through the avatars bucket', () => {
    const { storage } = createStorage();

    expect(storage.getPublicUrl('user-1/avatar.webp')).toBe(
      'https://example.test/avatar.webp',
    );
  });

  it('extracts only avatars public object paths', () => {
    const { storage } = createStorage();

    expect(
      storage.extractObjectPath(
        'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar%20one.webp',
      ),
    ).toBe('user-1/avatar one.webp');
    expect(
      storage.extractObjectPath(
        'https://project.supabase.co/storage/v1/object/public/documents/file.pdf',
      ),
    ).toBeNull();
    expect(storage.extractObjectPath('not-a-url')).toBeNull();
  });
});
