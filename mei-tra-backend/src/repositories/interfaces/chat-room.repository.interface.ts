import {
  ChatRoom,
  ChatRoomScope,
  ChatRoomVisibility,
  ChatRoomId,
  UserId,
} from '../../types/social.types';

export interface IChatRoomRepository {
  findById(id: ChatRoomId): Promise<ChatRoom | null>;
  findByScope(scope: ChatRoomScope): Promise<ChatRoom[]>;
  findByVisibility(visibility: ChatRoomVisibility): Promise<ChatRoom[]>;
  findByOwnerId(ownerId: UserId): Promise<ChatRoom[]>;
  create(room: ChatRoom): Promise<ChatRoom>;
  update(room: ChatRoom): Promise<ChatRoom>;
  delete(id: ChatRoomId): Promise<void>;
}
