export interface AvatarStorageUploadOptions {
  contentType: string;
  cacheControl: string;
  upsert: boolean;
}

export interface AvatarStorageListOptions {
  limit: number;
  offset?: number;
}

export interface IAvatarStorage {
  upload(
    objectPath: string,
    data: Buffer,
    options: AvatarStorageUploadOptions,
  ): Promise<void>;
  getPublicUrl(objectPath: string): string;
  remove(objectPaths: string[]): Promise<void>;
  list(prefix: string, options: AvatarStorageListOptions): Promise<string[]>;
  extractObjectPath(publicUrl: string): string | null;
}
