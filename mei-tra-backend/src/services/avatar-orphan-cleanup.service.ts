import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../database/supabase.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_PAGE_SIZE = 1000;
/** Bounds a pathological pagination loop; hitting it is logged, never silent. */
const MAX_LIST_PAGES = 100;
/** Keeps the `in` filter out of URL-length limits on large buckets. */
const PROFILE_LOOKUP_CHUNK = 200;

type AvatarBucket = ReturnType<SupabaseService['client']['storage']['from']>;

/**
 * The avatars bucket has no FK to auth.users, so purged accounts (notably the
 * pg_cron guest sweep) leave their folder behind. Reclaiming it has to go
 * through the Storage API: deleting storage.objects rows with SQL drops the
 * metadata but keeps the file on the storage backend, and removes the only
 * handle the bucket listing has on it. This sweep removes avatar files whose
 * owner folder no longer matches a user_profiles row. Scale-to-zero can delay
 * a run but never loses work: orphans wait for the next run.
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

    // Folder names are user ids by upload convention; ignore anything else.
    const candidateIds = (await this.listEntryNames(bucket, '')).filter(
      (name) => UUID_PATTERN.test(name),
    );
    if (candidateIds.length === 0) {
      return 0;
    }

    const liveIds = await this.findLiveProfileIds(candidateIds);
    const orphanIds = candidateIds.filter((id) => !liveIds.has(id));

    let removedCount = 0;
    for (const userId of orphanIds) {
      let paths: string[];
      try {
        paths = (await this.listEntryNames(bucket, userId)).map(
          (name) => `${userId}/${name}`,
        );
      } catch (error) {
        this.logger.warn(`Failed to list avatar folder ${userId}`, error);
        continue;
      }

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

  /** Walks every page so buckets larger than one page are not silently cut off. */
  private async listEntryNames(
    bucket: AvatarBucket,
    prefix: string,
  ): Promise<string[]> {
    const names: string[] = [];

    for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
      const { data, error } = await bucket.list(prefix, {
        limit: LIST_PAGE_SIZE,
        offset: page * LIST_PAGE_SIZE,
      });
      if (error) {
        throw error;
      }

      const entries = data ?? [];
      for (const entry of entries) {
        if (entry.name) {
          names.push(entry.name);
        }
      }

      if (entries.length < LIST_PAGE_SIZE) {
        return names;
      }
    }

    this.logger.warn(
      `Stopped listing "${prefix || '/'}" after ${MAX_LIST_PAGES} pages; ` +
        'the remainder waits for the next run',
    );
    return names;
  }

  private async findLiveProfileIds(
    candidateIds: string[],
  ): Promise<Set<string>> {
    const liveIds = new Set<string>();

    for (
      let start = 0;
      start < candidateIds.length;
      start += PROFILE_LOOKUP_CHUNK
    ) {
      const chunk = candidateIds.slice(start, start + PROFILE_LOOKUP_CHUNK);
      const { data, error } = await this.supabaseService.client
        .from('user_profiles')
        .select('id')
        .in('id', chunk);
      if (error) {
        throw error;
      }

      for (const row of (data ?? []) as { id: string }[]) {
        liveIds.add(row.id);
      }
    }

    return liveIds;
  }
}
