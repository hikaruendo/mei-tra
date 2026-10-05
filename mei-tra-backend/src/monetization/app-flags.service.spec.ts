import type { SupabaseService } from '../database/supabase.service';
import { AppFlagsService } from './app-flags.service';

describe('AppFlagsService', () => {
  const buildService = (rows: { key: string; value: unknown }[]) => {
    const select = jest.fn().mockResolvedValue({ data: rows, error: null });
    const from = jest.fn().mockReturnValue({ select });
    const service = new AppFlagsService({
      client: { from },
    } as unknown as SupabaseService);
    return { service, from };
  };

  it('maps rows into a flag object', async () => {
    const { service } = buildService([
      { key: 'monetization.membership_enabled', value: false },
      { key: 'ads.enabled', value: false },
    ]);

    await expect(service.getFlags(0)).resolves.toEqual({
      'monetization.membership_enabled': false,
      'ads.enabled': false,
    });
  });

  it('serves from cache inside the TTL and refetches after it', async () => {
    const { service, from } = buildService([
      { key: 'ads.enabled', value: false },
    ]);

    await service.getFlags(0);
    await service.getFlags(59_000);
    expect(from).toHaveBeenCalledTimes(1);

    await service.getFlags(61_000);
    expect(from).toHaveBeenCalledTimes(2);
  });
});
