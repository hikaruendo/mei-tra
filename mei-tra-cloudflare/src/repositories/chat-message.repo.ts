import { SupabaseClient } from '@supabase/supabase-js';
import { ChatMessageEvent, BasicProfile } from '../types';

interface ChatMessageRow {
  id: string;
  room_id: string;
  sender_id: string | null;
  content: string;
  content_type: string;
  reply_to: string | null;
  created_at: string;
}

export async function findMessagesByRoomId(
  supabase: SupabaseClient,
  roomId: string,
  limit = 50,
  cursor?: string,
): Promise<ChatMessageRow[]> {
  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data as ChatMessageRow[];
}

export async function createMessage(
  supabase: SupabaseClient,
  params: {
    id: string;
    roomId: string;
    senderId: string;
    content: string;
    contentType: string;
    replyTo?: string;
  },
): Promise<ChatMessageRow | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      id: params.id,
      room_id: params.roomId,
      sender_id: params.senderId,
      content: params.content,
      content_type: params.contentType,
      reply_to: params.replyTo ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to create chat message:', error?.message);
    return null;
  }

  return data as ChatMessageRow;
}

export function toMessageEvent(
  row: ChatMessageRow,
  sender: BasicProfile,
): ChatMessageEvent {
  return {
    id: row.id,
    roomId: row.room_id,
    sender,
    content: row.content,
    contentType: row.content_type as 'text' | 'emoji' | 'system',
    createdAt: row.created_at,
    replyTo: row.reply_to ?? undefined,
  };
}
