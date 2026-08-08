import { AccountDeletionBlocker } from '../../repositories/interfaces/user-profile.repository.interface';

export interface DeleteAccountResult {
  deleted: true;
  cleanup: {
    anonymizedRoomPlayerCount: number;
    anonymizedRoomCount: number;
    anonymizedGameStateCount: number;
    anonymizedGameHistoryCount: number;
    removedAvatarObjectCount: number;
  };
}

export interface IDeleteAccountUseCase {
  execute(userId: string): Promise<DeleteAccountResult>;
}

export class AccountDeletionBlockedError extends Error {
  constructor(readonly blockers: AccountDeletionBlocker[]) {
    super('Account has active room or game participation');
    this.name = 'AccountDeletionBlockedError';
  }
}

export class AccountDeletionFailedError extends Error {
  constructor(readonly step: 'storage' | 'database' | 'auth') {
    super('Account deletion failed');
    this.name = 'AccountDeletionFailedError';
  }
}
