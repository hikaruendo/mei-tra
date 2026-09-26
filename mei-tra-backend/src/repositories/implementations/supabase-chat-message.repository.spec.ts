import { SupabaseChatMessageRepository } from './supabase-chat-message.repository';
import { SupabaseService } from '../../database/supabase.service';
import { ChatRoomId } from '../../types/social.types';

describe('SupabaseChatMessageRepository', () => {
  it('excludes blocked senders, keeps system messages, then limits history', async () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      or: jest.fn(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.or.mockReturnValue(query);
    const supabase = {
      client: { from: jest.fn().mockReturnValue(query) },
    } as unknown as SupabaseService;
    const repository = new SupabaseChatMessageRepository(supabase);

    await repository.findByRoomId(ChatRoomId.create('room-1'), 2, undefined, [
      'blocked-user',
    ]);

    expect(query.or).toHaveBeenCalledWith(
      'sender_id.is.null,sender_id.not.in.(blocked-user)',
    );
    expect(query.limit).toHaveBeenCalledWith(2);
    expect(query.or.mock.invocationCallOrder[0]).toBeLessThan(
      query.limit.mock.invocationCallOrder[0],
    );
  });
});
