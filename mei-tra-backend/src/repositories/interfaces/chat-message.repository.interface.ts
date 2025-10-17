import { ChatMessage, ChatRoomId } from '../../types/social.types';

export interface IChatMessageRepository {
  findById(id: string): Promise<ChatMessage | null>;
  findByRoomId(
    roomId: ChatRoomId,
    limit?: number,
    cursor?: string,
  ): Promise<ChatMessage[]>;
  create(message: ChatMessage): Promise<ChatMessage>;
  deleteMessagesBefore(date: Date): Promise<number>;
  deleteByRoomId(roomId: ChatRoomId): Promise<void>;
}
