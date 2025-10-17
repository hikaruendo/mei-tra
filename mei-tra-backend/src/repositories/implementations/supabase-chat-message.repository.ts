/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { IChatMessageRepository } from '../interfaces/chat-message.repository.interface';
import { ChatMessage, ChatRoomId, UserId } from '../../types/social.types';

@Injectable()
export class SupabaseChatMessageRepository implements IChatMessageRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findById(id: string): Promise<ChatMessage | null> {
    const { data, error } = await this.supabase.client
      .from('chat_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.toDomain(data);
  }

  async findByRoomId(
    roomId: ChatRoomId,
    limit = 50,
    cursor?: string,
  ): Promise<ChatMessage[]> {
    let query = this.supabase.client
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId.getValue())
      .order('created_at', { ascending: true })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map((row) => this.toDomain(row));
  }

  async create(message: ChatMessage): Promise<ChatMessage> {
    const row = this.toRow(message);
    const { data, error } = await this.supabase.client
      .from('chat_messages')
      .insert(row as any)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create chat message: ${error?.message}`);
    }

    return this.toDomain(data);
  }

  async deleteMessagesBefore(date: Date): Promise<number> {
    const { data, error } = await this.supabase.client
      .from('chat_messages')
      .delete()
      .lt('created_at', date.toISOString())
      .select('id');

    if (error) {
      throw new Error(`Failed to delete messages: ${error.message}`);
    }

    return data?.length || 0;
  }

  async deleteByRoomId(roomId: ChatRoomId): Promise<void> {
    const { error } = await this.supabase.client
      .from('chat_messages')
      .delete()
      .eq('room_id', roomId.getValue());

    if (error) {
      throw new Error(`Failed to delete messages by room: ${error.message}`);
    }
  }

  private toDomain(row: Record<string, unknown>): ChatMessage {
    return ChatMessage.create({
      id: row.id as string,
      roomId: ChatRoomId.create(row.room_id as string),
      senderId: row.sender_id
        ? UserId.create(row.sender_id as string)
        : undefined,
      content: row.content as string,
      contentType: row.content_type as 'text' | 'emoji' | 'system',
      replyTo: row.reply_to as string | undefined,
      createdAt: new Date(row.created_at as string),
    });
  }

  private toRow(message: ChatMessage): Record<string, unknown> {
    return {
      id: message.getId(),
      room_id: message.getRoomId().getValue(),
      sender_id: message.getSenderId()?.getValue(),
      content: message.getContent(),
      content_type: message.getContentType(),
      reply_to: message.getReplyTo(),
      created_at: message.getCreatedAt().toISOString(),
    };
  }
}
