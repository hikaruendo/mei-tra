/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { IChatRoomRepository } from '../interfaces/chat-room.repository.interface';
import {
  ChatRoom,
  ChatRoomScope,
  ChatRoomVisibility,
  ChatRoomId,
  UserId,
} from '../../types/social.types';

@Injectable()
export class SupabaseChatRoomRepository implements IChatRoomRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findById(id: ChatRoomId): Promise<ChatRoom | null> {
    const { data, error } = await this.supabase.client
      .from('chat_rooms')
      .select('*')
      .eq('id', id.getValue())
      .single();

    if (error || !data) {
      return null;
    }

    return this.toDomain(data);
  }

  async findByScope(scope: ChatRoomScope): Promise<ChatRoom[]> {
    const { data, error } = await this.supabase.client
      .from('chat_rooms')
      .select('*')
      .eq('scope', scope);

    if (error || !data) {
      return [];
    }

    return data.map((row) => this.toDomain(row));
  }

  async findByVisibility(visibility: ChatRoomVisibility): Promise<ChatRoom[]> {
    const { data, error } = await this.supabase.client
      .from('chat_rooms')
      .select('*')
      .eq('visibility', visibility);

    if (error || !data) {
      return [];
    }

    return data.map((row) => this.toDomain(row));
  }

  async findByOwnerId(ownerId: UserId): Promise<ChatRoom[]> {
    const { data, error } = await this.supabase.client
      .from('chat_rooms')
      .select('*')
      .eq('owner_id', ownerId.getValue());

    if (error || !data) {
      return [];
    }

    return data.map((row) => this.toDomain(row));
  }

  async create(room: ChatRoom): Promise<ChatRoom> {
    const row = this.toRow(room);
    const { data, error } = await this.supabase.client
      .from('chat_rooms')
      .insert(row as any)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create chat room: ${error?.message}`);
    }

    return this.toDomain(data);
  }

  async update(room: ChatRoom): Promise<ChatRoom> {
    const row = this.toRow(room);
    const { data, error } = await (
      this.supabase.client.from('chat_rooms') as any
    )
      .update(row)
      .eq('id', room.getId().getValue())
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update chat room: ${error?.message}`);
    }

    return this.toDomain(data);
  }

  async delete(id: ChatRoomId): Promise<void> {
    const { error } = await this.supabase.client
      .from('chat_rooms')
      .delete()
      .eq('id', id.getValue());

    if (error) {
      throw new Error(`Failed to delete chat room: ${error.message}`);
    }
  }

  private toDomain(row: Record<string, unknown>): ChatRoom {
    return ChatRoom.create({
      id: ChatRoomId.create(row.id as string),
      scope: row.scope as ChatRoomScope,
      name: row.name as string | undefined,
      ownerId: row.owner_id ? UserId.create(row.owner_id as string) : undefined,
      visibility: row.visibility as ChatRoomVisibility,
      messageTtlHours: (row.message_ttl_hours as number) || 24,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    });
  }

  private toRow(room: ChatRoom): Record<string, unknown> {
    return {
      id: room.getId().getValue(),
      scope: room.getScope(),
      name: room.getName(),
      owner_id: room.getOwnerId()?.getValue(),
      visibility: room.getVisibility(),
      message_ttl_hours: room.getMessageTtlHours(),
      updated_at: new Date().toISOString(),
    };
  }
}
