/* eslint-disable @typescript-eslint/no-explicit-any */
type EventHandler = (...args: any[]) => void;

type EventName =
  | 'connect'
  | 'disconnect'
  | 'chat:joined'
  | 'chat:left'
  | 'chat:message'
  | 'chat:messages'
  | 'chat:typing'
  | 'chat:error';

type ClientEvent =
  | { type: 'join' }
  | { type: 'leave' }
  | { type: 'message'; content: string; contentType?: string; replyTo?: string }
  | { type: 'typing'; isTyping: boolean }
  | { type: 'list-messages'; limit?: number; cursor?: string };

interface BasicProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  countryCode?: string;
  rankTier: string;
}

type WorkerChatMessage = {
  id: string;
  roomId: string;
  sender: BasicProfile;
  content: string;
  contentType: 'text' | 'emoji' | 'system';
  createdAt: string;
  replyTo?: string;
};

type ServerEvent =
  | { type: 'chat:joined'; roomId: string; userId: string }
  | { type: 'chat:left'; roomId: string; userId: string }
  | { type: 'chat:message'; roomId: string; message: WorkerChatMessage }
  | { type: 'chat:messages'; roomId: string; messages: WorkerChatMessage[] }
  | { type: 'chat:typing'; roomId: string; userId: string; isTyping: boolean }
  | { type: 'chat:error'; message: string };

interface ConnectionState {
  socket: WebSocket;
  ready: boolean;
  queue: ClientEvent[];
}

export class CloudflareSocialSocket {
  private readonly baseUrl: string;
  private readonly getToken: () => Promise<string | null>;
  private readonly handlers = new Map<EventName, Set<EventHandler>>();
  private readonly connections = new Map<string, ConnectionState>();

  constructor(baseUrl: string, getToken: () => Promise<string | null>) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getToken = getToken;
  }

  get connected(): boolean {
    return this.connections.size > 0;
  }

  connect(): void {
    // no-op: individual room connections are managed lazily.
  }

  disconnect(): void {
    for (const [, conn] of this.connections) {
      conn.socket.close();
    }
    this.connections.clear();
    this.emitEvent('disconnect');
  }

  on(event: EventName, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: EventName, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, payload: Record<string, any>): void {
    switch (event) {
      case 'chat:join-room':
        this.ensureConnection(payload.roomId);
        break;
      case 'chat:leave-room':
        this.sendToRoom(payload.roomId, { type: 'leave' });
        this.closeConnection(payload.roomId);
        break;
      case 'chat:post-message':
        this.ensureConnection(payload.roomId);
        this.sendToRoom(payload.roomId, {
          type: 'message',
          content: payload.content,
          contentType: payload.contentType,
          replyTo: payload.replyTo,
        });
        break;
      case 'chat:list-messages':
        this.ensureConnection(payload.roomId);
        this.sendToRoom(payload.roomId, {
          type: 'list-messages',
          limit: payload.limit,
          cursor: payload.cursor,
        });
        break;
      case 'chat:typing':
        this.ensureConnection(payload.roomId);
        this.sendToRoom(payload.roomId, {
          type: 'typing',
          isTyping: true,
        });
        break;
      default:
        console.warn('[CloudflareSocialSocket] Unsupported emit event:', event);
    }
  }

  private async ensureConnection(roomId: string): Promise<void> {
    if (this.connections.has(roomId)) {
      return;
    }

    const token = await this.getToken();
    if (!token) {
      console.error('[CloudflareSocialSocket] No auth token available');
      this.emitEvent('chat:error', { message: 'Not authenticated' });
      return;
    }

    const wsUrl = `${this.baseUrl}/ws?roomId=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    const state: ConnectionState = {
      socket: ws,
      ready: false,
      queue: [],
    };
    this.connections.set(roomId, state);

    ws.addEventListener('open', () => {
      state.ready = true;
      // Send join event first, then flush queued events
      state.queue.unshift({ type: 'join' });
      this.flushQueue(roomId);
      if (this.connections.size === 1) {
        this.emitEvent('connect');
      }
    });

    ws.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data as string) as ServerEvent;
        this.processServerEvent(payload);
      } catch (error) {
        console.error('[CloudflareSocialSocket] Failed parsing message:', error);
      }
    });

    ws.addEventListener('close', () => {
      this.connections.delete(roomId);
      if (this.connections.size === 0) {
        this.emitEvent('disconnect');
      }
    });

    ws.addEventListener('error', (error) => {
      console.error('[CloudflareSocialSocket] Socket error:', error);
      this.emitEvent('chat:error', { message: 'connection error' });
    });
  }

  private closeConnection(roomId: string): void {
    const conn = this.connections.get(roomId);
    if (!conn) return;
    conn.socket.close();
    this.connections.delete(roomId);
    if (this.connections.size === 0) {
      this.emitEvent('disconnect');
    }
  }

  private flushQueue(roomId: string): void {
    const conn = this.connections.get(roomId);
    if (!conn || !conn.ready) return;
    while (conn.queue.length > 0) {
      const next = conn.queue.shift();
      if (next) {
        conn.socket.send(JSON.stringify(next));
      }
    }
  }

  private sendToRoom(roomId: string, event: ClientEvent): void {
    const conn = this.connections.get(roomId);
    if (!conn) {
      console.warn('[CloudflareSocialSocket] No connection for room', roomId);
      return;
    }
    if (!conn.ready) {
      conn.queue.push(event);
      return;
    }
    conn.socket.send(JSON.stringify(event));
  }

  private processServerEvent(event: ServerEvent): void {
    switch (event.type) {
      case 'chat:joined':
        this.emitEvent('chat:joined', {
          roomId: event.roomId,
          userId: event.userId,
        });
        break;
      case 'chat:left':
        this.emitEvent('chat:left', {
          roomId: event.roomId,
          userId: event.userId,
        });
        break;
      case 'chat:message':
        this.emitEvent('chat:message', {
          type: 'chat.message',
          roomId: event.roomId,
          message: event.message,
        });
        break;
      case 'chat:messages':
        this.emitEvent('chat:messages', {
          roomId: event.roomId,
          messages: event.messages,
        });
        break;
      case 'chat:typing':
        this.emitEvent('chat:typing', {
          type: 'chat.typing',
          roomId: event.roomId,
          userId: event.userId,
          startedAt: new Date().toISOString(),
        });
        break;
      case 'chat:error':
        this.emitEvent('chat:error', { message: event.message });
        break;
      default:
        break;
    }
  }

  private emitEvent(event: EventName, payload?: Record<string, any>): void {
    const listeners = this.handlers.get(event);
    if (!listeners) return;
    for (const handler of listeners) {
      handler(payload);
    }
  }
}
