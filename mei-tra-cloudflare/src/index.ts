import { Env } from './env';
import { createSupabaseClient } from './supabase';
import { validateToken } from './auth';
import { json, handleCorsPreflightRequest } from './cors';

export { ChatRoomDurableObject } from './durable-objects/chat-room';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return handleCorsPreflightRequest();
    }

    if (url.pathname === '/api/health') {
      return json({
        status: 'ok',
        runtime: 'cloudflare-workers',
        timestamp: Date.now(),
      });
    }

    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('roomId');
      if (!roomId) {
        return json({ error: 'roomId is required' }, 400);
      }

      const token = url.searchParams.get('token');
      if (!token) {
        return json({ error: 'token is required' }, 401);
      }

      const supabase = createSupabaseClient(env);
      const userId = await validateToken(supabase, token);
      if (!userId) {
        return json({ error: 'Invalid or expired token' }, 401);
      }

      const id = env.CHAT_ROOM.idFromName(roomId);
      const stub = env.CHAT_ROOM.get(id);

      const target = new URL(request.url);
      target.pathname = '/connect';
      target.searchParams.set('userId', userId);
      // Remove token from forwarded URL for security
      target.searchParams.delete('token');

      return stub.fetch(target.toString(), request);
    }

    return json({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
