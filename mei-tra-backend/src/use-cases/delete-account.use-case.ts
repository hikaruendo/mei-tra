import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../database/supabase.service';
import { IAvatarStorage } from '../storage/interfaces/avatar-storage.interface';
import {
  IAccountDeletionRepository,
  IUserProfileRepository,
} from '../repositories/interfaces/user-profile.repository.interface';
import {
  AccountDeletionBlockedError,
  AccountDeletionFailedError,
  DeleteAccountResult,
  IDeleteAccountUseCase,
} from './interfaces/delete-account.use-case.interface';

@Injectable()
export class DeleteAccountUseCase implements IDeleteAccountUseCase {
  private readonly logger = new Logger(DeleteAccountUseCase.name);

  constructor(
    @Inject('IUserProfileRepository')
    private readonly userProfileRepository: IUserProfileRepository &
      IAccountDeletionRepository,
    private readonly supabaseService: SupabaseService,
    private readonly authService: AuthService,
    @Inject('IAvatarStorage')
    private readonly avatarStorage: IAvatarStorage,
  ) {}

  async execute(userId: string): Promise<DeleteAccountResult> {
    await this.ensureAccountCanBeDeleted(userId);

    let profile: Awaited<ReturnType<IUserProfileRepository['findById']>>;
    try {
      profile =
        await this.userProfileRepository.markAccountDeletionStarted(userId);
    } catch (error) {
      if (this.isConcurrentRoomMembershipBlock(error)) {
        const blockers =
          await this.userProfileRepository.findAccountDeletionBlockers(userId);
        throw new AccountDeletionBlockedError(blockers);
      }
      this.logger.error('Failed to mark account deletion before cleanup', {
        userId,
        error: this.describeUnknownError(error),
      });
      throw new AccountDeletionFailedError('database');
    }

    await this.ensureAccountCanBeDeleted(userId);

    const removedAvatarObjectCount = await this.deleteAvatarObjects(
      userId,
      profile?.avatarUrl,
    );

    let cleanup: DeleteAccountResult['cleanup'];
    try {
      const databaseCleanup =
        await this.userProfileRepository.anonymizeAccountReferences(userId);
      cleanup = {
        ...databaseCleanup,
        removedAvatarObjectCount,
      };
    } catch (error) {
      this.logger.error('Failed to anonymize account data before deletion', {
        userId,
        error: this.describeUnknownError(error),
      });
      throw new AccountDeletionFailedError('database');
    }

    const { error } = await this.supabaseService.client.auth.admin.deleteUser(
      userId,
      false,
    );
    if (error) {
      if (this.isAuthUserAlreadyDeleted(error)) {
        this.logger.warn('Supabase Auth user was already deleted', { userId });
        this.authService.invalidateUser(userId);
        return {
          deleted: true,
          cleanup,
        };
      }

      this.logger.error('Failed to delete Supabase Auth user', {
        userId,
        errorName: error.name,
        errorStatus: error.status,
      });
      throw new AccountDeletionFailedError('auth');
    }

    this.authService.invalidateUser(userId);

    return {
      deleted: true,
      cleanup,
    };
  }

  private async ensureAccountCanBeDeleted(userId: string): Promise<void> {
    const blockers =
      await this.userProfileRepository.findAccountDeletionBlockers(userId);
    if (blockers.length > 0) {
      throw new AccountDeletionBlockedError(blockers);
    }
  }

  private async deleteAvatarObjects(
    userId: string,
    avatarUrl?: string,
  ): Promise<number> {
    const objectPaths = new Set<string>();
    const avatarObjectPath = avatarUrl
      ? this.extractOwnedAvatarObjectPath(userId, avatarUrl)
      : null;

    if (avatarObjectPath) {
      objectPaths.add(avatarObjectPath);
    }

    let listedObjectNames: string[];
    try {
      listedObjectNames = await this.avatarStorage.list(userId, {
        limit: 1000,
      });
    } catch (error) {
      this.logger.error('Failed to list avatar objects before account delete', {
        userId,
        error: this.describeUnknownError(error),
      });
      throw new AccountDeletionFailedError('storage');
    }

    for (const objectName of listedObjectNames) {
      objectPaths.add(`${userId}/${objectName}`);
    }

    if (objectPaths.size === 0) {
      return 0;
    }

    try {
      await this.avatarStorage.remove([...objectPaths]);
    } catch (error) {
      this.logger.error(
        'Failed to remove avatar objects before account delete',
        {
          userId,
          error: this.describeUnknownError(error),
        },
      );
      throw new AccountDeletionFailedError('storage');
    }

    return objectPaths.size;
  }

  private extractOwnedAvatarObjectPath(
    userId: string,
    avatarUrl: string,
  ): string | null {
    const objectPath = this.avatarStorage.extractObjectPath(avatarUrl);
    if (!objectPath) {
      return null;
    }

    const pathSegments = objectPath.split('/');
    if (
      pathSegments.length < 2 ||
      pathSegments[0] !== userId ||
      pathSegments.some(
        (pathSegment) =>
          pathSegment.length === 0 ||
          pathSegment === '.' ||
          pathSegment === '..',
      )
    ) {
      this.logger.warn('Ignoring avatar URL outside the deleting user folder', {
        userId,
      });
      return null;
    }

    return objectPath;
  }

  private isAuthUserAlreadyDeleted(error: {
    status?: number;
    message?: string;
  }): boolean {
    return (
      error.status === 404 &&
      typeof error.message === 'string' &&
      error.message.toLowerCase().includes('not found')
    );
  }

  private isConcurrentRoomMembershipBlock(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const maybeError = error as { code?: unknown; message?: unknown };
    return (
      maybeError.code === 'PT409' ||
      (typeof maybeError.message === 'string' &&
        maybeError.message.includes('account_deletion_blocked'))
    );
  }

  private describeUnknownError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }

    return 'unknown error';
  }
}
