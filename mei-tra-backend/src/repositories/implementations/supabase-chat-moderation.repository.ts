import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { IChatModerationRepository } from '../interfaces/chat-moderation.repository.interface';

@Injectable()
export class SupabaseChatModerationRepository
  implements IChatModerationRepository
{
  constructor(private readonly supabase: SupabaseService) {}

  async findBlockedUserIds(blockerId: string): Promise<string[]> {
    const { data, error } = await this.supabase.client
      .from('chat_user_blocks')
      .select('blocked_id')
      .eq('blocker_id', blockerId);
    if (error) throw error;
    return data.map((row) => row.blocked_id);
  }

  async findUsersBlockingSender(senderId: string): Promise<string[]> {
    const { data, error } = await this.supabase.client
      .from('chat_user_blocks')
      .select('blocker_id')
      .eq('blocked_id', senderId);
    if (error) throw error;
    return data.map((row) => row.blocker_id);
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('chat_user_blocks')
      .upsert({ blocker_id: blockerId, blocked_id: blockedId });
    if (error) throw error;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('chat_user_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);
    if (error) throw error;
  }

  async createReport(
    input: Parameters<IChatModerationRepository['createReport']>[0],
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from('chat_message_reports')
      .insert({
        reporter_id: input.reporterId,
        reported_sender_id: input.reportedSenderId,
        message_id: input.messageId,
        room_id: input.roomId,
        content_snapshot: input.contentSnapshot,
        reason: input.reason,
      });
    if (error && error.code !== '23505') throw error;
  }
}
