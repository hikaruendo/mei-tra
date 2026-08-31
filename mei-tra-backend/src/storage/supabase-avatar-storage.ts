import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import {
  AvatarStorageListOptions,
  AvatarStorageUploadOptions,
  IAvatarStorage,
} from './interfaces/avatar-storage.interface';

const AVATAR_BUCKET = 'avatars';
const PUBLIC_OBJECT_PATH_MARKER = `/storage/v1/object/public/${AVATAR_BUCKET}/`;

@Injectable()
export class SupabaseAvatarStorage implements IAvatarStorage {
  constructor(private readonly supabaseService: SupabaseService) {}

  async upload(
    objectPath: string,
    data: Buffer,
    options: AvatarStorageUploadOptions,
  ): Promise<void> {
    const { error } = await this.bucket.upload(objectPath, data, options);
    if (error) {
      throw error;
    }
  }

  getPublicUrl(objectPath: string): string {
    return this.bucket.getPublicUrl(objectPath).data.publicUrl;
  }

  async remove(objectPaths: string[]): Promise<void> {
    const { error } = await this.bucket.remove(objectPaths);
    if (error) {
      throw error;
    }
  }

  async list(
    prefix: string,
    options: AvatarStorageListOptions,
  ): Promise<string[]> {
    const { data, error } = await this.bucket.list(prefix, options);
    if (error) {
      throw error;
    }

    return (data ?? [])
      .map((entry) => entry.name)
      .filter((name): name is string => Boolean(name));
  }

  extractObjectPath(publicUrl: string): string | null {
    try {
      const decodedPath = decodeURIComponent(new URL(publicUrl).pathname);
      const markerIndex = decodedPath.indexOf(PUBLIC_OBJECT_PATH_MARKER);
      if (markerIndex === -1) {
        return null;
      }

      const objectPath = decodedPath.slice(
        markerIndex + PUBLIC_OBJECT_PATH_MARKER.length,
      );
      return objectPath || null;
    } catch {
      return null;
    }
  }

  private get bucket() {
    return this.supabaseService.client.storage.from(AVATAR_BUCKET);
  }
}
