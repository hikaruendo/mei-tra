import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../database/supabase.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The pg_cron guest purge (cleanup_stale_anonymous_users) deletes
 * storage.objects rows with plain SQL, which leaves the physical files behind
 * in the storage backend — only the Storage API deletes actual file data.
 * This sweep removes avatar files whose owner folder no longer matches a
 * user_profiles row. Scale-to-zero can delay a run but never loses work:
 * orphans simply wait for the next day the backend is awake.
 */
@Injectable()
export class AvatarOrphanCleanupService {
  private readonly logger = new Logger(AvatarOrphanCleanupService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async cleanupOrphanedAvatarFolders(): Promise<void> {
    try {
      const removed = await this.removeOrphanedAvatarObjects();
      if (removed > 0) {
        this.logger.log(`Removed ${removed} orphaned avatar object(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup orphaned avatar folders', error);
    }
  }

  async removeOrphanedAvatarObjects(): Promise<number> {
    const bucket = this.supabaseService.client.storage.from('avatars');

    const { data: folders, error: listError } = await bucket.list('', {
      limit: 1000,
    });
    if (listError) {
      throw listError;
    }

    // Folder names are user ids by upload convention; ignore anything else.
    const candidateIds = (folders ?? [])
      .map((entry) => entry.name)
      .filter((name): name is string =>
        Boolean(name && UUID_PATTERN.test(name)),
      );
    if (candidateIds.length === 0) {
      return 0;
    }

    const { data: profiles, error: profileError } =
      await this.supabaseService.client
        .from('user_profiles')
        .select('id')
        .in('id', candidateIds);
    if (profileError) {
      throw profileError;
    }

    const liveIds = new Set(
      ((profiles ?? []) as { id: string }[]).map((row) => row.id),
    );
    const orphanIds = candidateIds.filter((id) => !liveIds.has(id));

    let removedCount = 0;
    for (const userId of orphanIds) {
      const { data: objects, error: folderError } = await bucket.list(userId, {
        limit: 1000,
      });
      if (folderError) {
        this.logger.warn(`Failed to list avatar folder ${userId}`, folderError);
        continue;
      }

      const paths = (objects ?? [])
        .filter((object) => object.name)
        .map((object) => `${userId}/${object.name}`);
      if (paths.length === 0) {
        continue;
      }

      const { error: removeError } = await bucket.remove(paths);
      if (removeError) {
        this.logger.warn(
          `Failed to remove avatar objects for ${userId}`,
          removeError,
        );
        continue;
      }

      removedCount += paths.length;
    }

    return removedCount;
  }
}
