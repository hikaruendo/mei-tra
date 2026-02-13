import { SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../env';
import { createSupabaseClient } from '../supabase';
import { BasicProfile, ChatMessageEvent, ClientEvent, ServerEvent } from '../types';
import {
  findMessagesByRoomId,
  createMessage,
  toMessageEvent,
} from '../repositories/chat-message.repo';
import { findProfileById, findProfilesByIds } from '../repositories/user-profile.repo';

export class ChatRoomDurableObject {
  private readonly sockets = new Map<WebSocket, string>();
  private readonly profileCache = new Map<string, BasicProfile>();
  private roomId: string;
  private supabase: SupabaseClient;

  constructor(
    private readonly state: DurableObjectState,
    env: Env,
  ) {
    this.roomId = state.id.toString();
    this.supabase = createSupabaseClient(env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/connect') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected websocket', { status: 426 });
      }

      this.roomId =
        url.searchParams.get('roomId') ?? this.roomId;

      const userId = url.searchParams.get('userId');
      if (!userId) {
        return new Response('userId is required', { status: 400 });
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      this.state.acceptWebSocket(server);
      this.sockets.set(server, userId);

      // Pre-cache profile for this user
      this.cacheProfile(userId);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (url.pathname === '/state') {
      return Response.json({
        connectedClients: this.sockets.size,
        roomId: this.roomId,
      });
    }

    return Response.json({ error: 'not found' }, { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text =
      typeof message === 'string'
        ? message
        : new TextDecoder().decode(message as ArrayBuffer);

    let event: ClientEvent;
    try {
      event = JSON.parse(text) as ClientEvent;
    } catch {
      this.send(ws, { type: 'chat:error', message: 'Invalid payload' });
      return;
    }

    const userId = this.sockets.get(ws);
    if (!userId) {
      this.send(ws, { type: 'chat:error', message: 'Not authenticated' });
      return;
    }

    switch (event.type) {
      case 'join':
        this.send(ws, {
          type: 'chat:joined',
          roomId: this.roomId,
          userId,
        });
        break;

      case 'leave':
        this.handleLeave(ws);
        break;

      case 'message':
        await this.handleMessage(ws, userId, event);
        break;

      case 'typing':
        this.broadcast(
          {
            type: 'chat:typing',
            roomId: this.roomId,
            userId,
            isTyping: event.isTyping,
          },
          ws,
        );
        break;

      case 'list-messages':
        await this.handleListMessages(ws, event.limit, event.cursor);
        break;

      default:
        this.send(ws, {
          type: 'chat:error',
          message: `Unknown event ${(event as { type?: string }).type ?? ''}`,
        });
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.handleLeave(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.handleLeave(ws);
  }

  private handleLeave(ws: WebSocket): void {
    const userId = this.sockets.get(ws);
    this.sockets.delete(ws);
    if (userId) {
      this.broadcast(
        { type: 'chat:left', roomId: this.roomId, userId },
        ws,
      );
    }
  }

  private async handleMessage(
    ws: WebSocket,
    userId: string,
    event: Extract<ClientEvent, { type: 'message' }>,
  ): Promise<void> {
    if (!event.content) {
      this.send(ws, { type: 'chat:error', message: 'content is required' });
      return;
    }

    const profile = await this.getProfile(userId);
    const id = crypto.randomUUID();
    const contentType = event.contentType ?? 'text';

    const row = await createMessage(this.supabase, {
      id,
      roomId: this.roomId,
      senderId: userId,
      content: event.content,
      contentType,
      replyTo: event.replyTo,
    });

    const msg: ChatMessageEvent = row
      ? toMessageEvent(row, profile)
      : {
          id,
          roomId: this.roomId,
          sender: profile,
          content: event.content,
          contentType: contentType as 'text' | 'emoji' | 'system',
          createdAt: new Date().toISOString(),
          replyTo: event.replyTo,
        };

    this.broadcast({ type: 'chat:message', roomId: this.roomId, message: msg });
  }

  private async handleListMessages(
    ws: WebSocket,
    limit?: number,
    cursor?: string,
  ): Promise<void> {
    const rows = await findMessagesByRoomId(
      this.supabase,
      this.roomId,
      limit ?? 50,
      cursor,
    );

    // Collect unique sender IDs and bulk-fetch profiles
    const senderIds = [...new Set(
      rows.map((r) => r.sender_id).filter((id): id is string => id !== null),
    )];
    const uncachedIds = senderIds.filter((id) => !this.profileCache.has(id));
    if (uncachedIds.length > 0) {
      const profiles = await findProfilesByIds(this.supabase, uncachedIds);
      for (const [id, profile] of profiles) {
        this.profileCache.set(id, profile);
      }
    }

    const messages: ChatMessageEvent[] = rows.map((row) => {
      const sender = row.sender_id
        ? this.profileCache.get(row.sender_id) ?? fallbackProfile(row.sender_id)
        : fallbackProfile('system');
      return toMessageEvent(row, sender);
    });

    this.send(ws, { type: 'chat:messages', roomId: this.roomId, messages });
  }

  private async getProfile(userId: string): Promise<BasicProfile> {
    const cached = this.profileCache.get(userId);
    if (cached) return cached;

    const profile = await findProfileById(this.supabase, userId);
    if (profile) {
      this.profileCache.set(userId, profile);
      return profile;
    }

    return fallbackProfile(userId);
  }

  private async cacheProfile(userId: string): Promise<void> {
    if (this.profileCache.has(userId)) return;
    const profile = await findProfileById(this.supabase, userId);
    if (profile) {
      this.profileCache.set(userId, profile);
    }
  }

  private broadcast(event: ServerEvent, sender?: WebSocket): void {
    const payload = JSON.stringify(event);
    for (const socket of this.sockets.keys()) {
      if (socket === sender) continue;
      this.send(socket, payload);
    }
  }

  private send(ws: WebSocket, event: ServerEvent | string): void {
    const payload = typeof event === 'string' ? event : JSON.stringify(event);
    try {
      ws.send(payload);
    } catch {
      this.sockets.delete(ws);
    }
  }
}

function fallbackProfile(userId: string): BasicProfile {
  return {
    userId,
    displayName: userId.slice(0, 8),
    rankTier: 'bronze',
  };
}
