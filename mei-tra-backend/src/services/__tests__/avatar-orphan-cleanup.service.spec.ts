import { AvatarOrphanCleanupService } from '../avatar-orphan-cleanup.service';
import { SupabaseService } from '../../database/supabase.service';

const LIVE_USER_ID = '11111111-2222-4333-8444-555555555555';
const ORPHAN_USER_ID = '99999999-8888-4777-8666-555555555555';

describe('AvatarOrphanCleanupService', () => {
  let bucket: { list: jest.Mock; remove: jest.Mock };
  let profilesIn: jest.Mock;
  let service: AvatarOrphanCleanupService;

  const buildService = () => {
    const client = {
      storage: { from: jest.fn(() => bucket) },
      from: jest.fn(() => ({
        select: jest.fn(() => ({ in: profilesIn })),
      })),
    };
    return new AvatarOrphanCleanupService({
      client,
    } as unknown as SupabaseService);
  };

  beforeEach(() => {
    bucket = { list: jest.fn(), remove: jest.fn() };
    profilesIn = jest.fn();
    service = buildService();
  });

  it('removes files only under folders whose profile row is gone', async () => {
    bucket.list.mockImplementation((path: string) => {
      if (path === '') {
        return Promise.resolve({
          data: [
            { name: LIVE_USER_ID },
            { name: ORPHAN_USER_ID },
            { name: 'not-a-uuid' },
          ],
          error: null,
        });
      }
      return Promise.resolve({
        data: [{ name: 'avatar.webp' }],
        error: null,
      });
    });
    profilesIn.mockResolvedValue({
      data: [{ id: LIVE_USER_ID }],
      error: null,
    });
    bucket.remove.mockResolvedValue({ data: null, error: null });

    const removed = await service.removeOrphanedAvatarObjects();

    expect(removed).toBe(1);
    expect(bucket.remove).toHaveBeenCalledTimes(1);
    expect(bucket.remove).toHaveBeenCalledWith([
      `${ORPHAN_USER_ID}/avatar.webp`,
    ]);
    expect(profilesIn).toHaveBeenCalledWith('id', [
      LIVE_USER_ID,
      ORPHAN_USER_ID,
    ]);
  });

  it('removes nothing when every folder still has a profile', async () => {
    bucket.list.mockResolvedValue({
      data: [{ name: LIVE_USER_ID }],
      error: null,
    });
    profilesIn.mockResolvedValue({
      data: [{ id: LIVE_USER_ID }],
      error: null,
    });

    const removed = await service.removeOrphanedAvatarObjects();

    expect(removed).toBe(0);
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it('throws when the bucket root cannot be listed', async () => {
    const listError = new Error('storage down');
    bucket.list.mockResolvedValue({ data: null, error: listError });

    await expect(service.removeOrphanedAvatarObjects()).rejects.toThrow(
      'storage down',
    );
  });
});
