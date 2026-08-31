import { AvatarOrphanCleanupService } from '../avatar-orphan-cleanup.service';
import { SupabaseService } from '../../database/supabase.service';
import { IAvatarStorage } from '../../storage/interfaces/avatar-storage.interface';

const LIVE_USER_ID = '11111111-2222-4333-8444-555555555555';
const ORPHAN_USER_ID = '99999999-8888-4777-8666-555555555555';

describe('AvatarOrphanCleanupService', () => {
  let avatarStorage: jest.Mocked<IAvatarStorage>;
  let profilesIn: jest.Mock;
  let service: AvatarOrphanCleanupService;

  const buildService = () => {
    const client = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({ in: profilesIn })),
      })),
    };
    return new AvatarOrphanCleanupService(
      { client } as unknown as SupabaseService,
      avatarStorage,
    );
  };

  beforeEach(() => {
    avatarStorage = {
      upload: jest.fn(),
      getPublicUrl: jest.fn(),
      remove: jest.fn(),
      list: jest.fn(),
      extractObjectPath: jest.fn(),
    };
    profilesIn = jest.fn();
    service = buildService();
  });

  it('removes files only under folders whose profile row is gone', async () => {
    avatarStorage.list.mockImplementation((path: string) => {
      if (path === '') {
        return Promise.resolve([LIVE_USER_ID, ORPHAN_USER_ID, 'not-a-uuid']);
      }
      return Promise.resolve(['avatar.webp']);
    });
    profilesIn.mockResolvedValue({
      data: [{ id: LIVE_USER_ID }],
      error: null,
    });
    avatarStorage.remove.mockResolvedValue();

    const removed = await service.removeOrphanedAvatarObjects();

    expect(removed).toBe(1);
    expect(avatarStorage.remove).toHaveBeenCalledTimes(1);
    expect(avatarStorage.remove).toHaveBeenCalledWith([
      `${ORPHAN_USER_ID}/avatar.webp`,
    ]);
    expect(profilesIn).toHaveBeenCalledWith('id', [
      LIVE_USER_ID,
      ORPHAN_USER_ID,
    ]);
  });

  it('removes nothing when every folder still has a profile', async () => {
    avatarStorage.list.mockResolvedValue([LIVE_USER_ID]);
    profilesIn.mockResolvedValue({
      data: [{ id: LIVE_USER_ID }],
      error: null,
    });

    const removed = await service.removeOrphanedAvatarObjects();

    expect(removed).toBe(0);
    expect(avatarStorage.remove).not.toHaveBeenCalled();
  });

  it('walks every page instead of stopping at the first one', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, i) =>
      i === 0 ? ORPHAN_USER_ID : `filler-${i}`,
    );
    avatarStorage.list.mockImplementation(
      (path: string, opts: { offset?: number }) => {
        if (path === '') {
          // Only the second page carries the live folder, so a non-paginating
          // implementation would treat it as absent.
          return Promise.resolve(
            opts.offset === 0 ? firstPage : [LIVE_USER_ID],
          );
        }
        return Promise.resolve(['avatar.webp']);
      },
    );
    profilesIn.mockResolvedValue({
      data: [{ id: LIVE_USER_ID }],
      error: null,
    });
    avatarStorage.remove.mockResolvedValue();

    const removed = await service.removeOrphanedAvatarObjects();

    expect(removed).toBe(1);
    expect(avatarStorage.remove).toHaveBeenCalledWith([
      `${ORPHAN_USER_ID}/avatar.webp`,
    ]);
    // Pin the stride too: `offset: page` would also produce >1 call but skip rows.
    const rootOffsets = avatarStorage.list.mock.calls
      .filter(([p]) => p === '')
      .map(([, opts]) => opts as { offset: number; limit: number });
    expect(rootOffsets.map((o) => o.offset)).toEqual([0, 1000]);
    expect(rootOffsets.every((o) => o.limit === 1000)).toBe(true);
  });

  it('splits the profile lookup so the in-filter cannot blow the URL limit', async () => {
    const ids = Array.from(
      { length: 450 },
      (_, i) =>
        `${i.toString(16).padStart(8, '0')}-2222-4333-8444-555555555555`,
    );
    avatarStorage.list.mockImplementation(
      (path: string, opts: { offset?: number }) =>
        path === ''
          ? Promise.resolve(opts.offset === 0 ? ids : [])
          : Promise.resolve([]),
    );
    profilesIn.mockImplementation((_col: string, chunk: string[]) =>
      Promise.resolve({ data: chunk.map((id) => ({ id })), error: null }),
    );

    await service.removeOrphanedAvatarObjects();

    expect(profilesIn).toHaveBeenCalledTimes(3);
    for (const [, chunk] of profilesIn.mock.calls) {
      expect((chunk as string[]).length).toBeLessThanOrEqual(200);
    }
    expect(avatarStorage.remove).not.toHaveBeenCalled();
  });

  it('throws when the bucket root cannot be listed', async () => {
    const listError = new Error('storage down');
    avatarStorage.list.mockRejectedValue(listError);

    await expect(service.removeOrphanedAvatarObjects()).rejects.toThrow(
      'storage down',
    );
  });
});
