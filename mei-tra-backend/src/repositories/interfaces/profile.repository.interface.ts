import { Profile, UserId } from '../../types/social.types';

export interface IProfileRepository {
  findByUserId(userId: UserId): Promise<Profile | null>;
  findByUserIds(userIds: UserId[]): Promise<Profile[]>;
  findByDisplayName(displayName: string): Promise<Profile[]>;
  create(profile: Profile): Promise<Profile>;
  update(profile: Profile): Promise<Profile>;
  updateLastOnline(userId: UserId): Promise<void>;
}
