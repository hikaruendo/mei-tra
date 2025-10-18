import {
  UserProfile,
  CreateUserProfileDto,
  UpdateUserProfileDto,
  ChatProfileDto,
} from '../../types/user.types';

export interface IUserProfileRepository {
  findById(id: string): Promise<UserProfile | null>;
  findByUsername(username: string): Promise<UserProfile | null>;
  findByUserIds(userIds: string[]): Promise<ChatProfileDto[]>;
  create(id: string, data: CreateUserProfileDto): Promise<UserProfile>;
  update(id: string, data: UpdateUserProfileDto): Promise<UserProfile>;
  delete(id: string): Promise<boolean>;
  updateLastSeen(id: string): Promise<void>;
  updateGameStats(
    id: string,
    gamesPlayed: number,
    gamesWon: number,
    score: number,
  ): Promise<void>;
  searchByUsername(query: string, limit?: number): Promise<UserProfile[]>;
}
