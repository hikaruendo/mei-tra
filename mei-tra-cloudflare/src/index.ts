interface Env {
  GAME_ROOM: DurableObjectNamespace;
}

type ClientEvent =
  | { type: "join"; userId: string }
  | { type: "leave"; userId?: string }
  | { type: "message"; userId: string; content: string; contentType?: string }
  | { type: "typing"; userId: string; isTyping: boolean }
  | { type: "list-messages"; limit?: number };

type ChatMessageEvent = {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  contentType?: string;
  createdAt: string;
};

type ServerEvent =
  | { type: "chat:joined"; roomId: string; userId: string }
  | { type: "chat:left"; roomId: string; userId: string }
  | { type: "chat:message"; roomId: string; message: ChatMessageEvent }
  | { type: "chat:messages"; roomId: string; messages: ChatMessageEvent[] }
  | { type: "chat:typing"; roomId: string; userId: string; isTyping: boolean }
  | { type: "chat:error"; message: string };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        status: "ok",
        runtime: "cloudflare-workers",
        timestamp: Date.now(),
      });
    }

    if (url.pathname === "/ws") {
      const roomId = url.searchParams.get("roomId");
      if (!roomId) {
        return json({ error: "roomId is required" }, 400);
      }

      const id = env.GAME_ROOM.idFromName(roomId);
      const stub = env.GAME_ROOM.get(id);
      const target = new URL(request.url);
      target.pathname = "/connect";
      return stub.fetch(target.toString(), request);
    }

    return json({ error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;

export class RoomDurableObject {
  private readonly sockets = new Map<WebSocket, string>();
  private readonly messages: ChatMessageEvent[] = [];
  private roomId: string;
  private nextMessageId = 1;

  constructor(private readonly state: DurableObjectState) {
    this.roomId = state.id.toString();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }

      this.roomId =
        url.searchParams.get("roomId") ??
        this.roomId ??
        this.state.id.toString();

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      this.state.acceptWebSocket(server);
      this.sockets.set(server, "");

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (url.pathname === "/state") {
      return json({
        connectedClients: this.sockets.size,
        storedMessages: this.messages.length,
      });
    }

    return json({ error: "not found" }, 404);
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const text =
      typeof message === "string"
        ? message
        : new TextDecoder().decode(message as ArrayBuffer);

    let event: ClientEvent;
    try {
      event = JSON.parse(text) as ClientEvent;
    } catch {
      this.send(ws, {
        type: "chat:error",
        message: "Invalid payload",
      });
      return;
    }

    switch (event.type) {
      case "join":
        if (!event.userId) {
          this.send(ws, {
            type: "chat:error",
            message: "userId is required to join",
          });
          break;
        }
        this.sockets.set(ws, event.userId);
        this.send(ws, {
          type: "chat:joined",
          roomId: this.roomId,
          userId: event.userId,
        });
        break;
      case "leave":
        this.handleLeave(ws);
        break;
      case "message":
        this.handleMessage(ws, event);
        break;
      case "typing":
        this.broadcast(
          {
            type: "chat:typing",
            roomId: this.roomId,
            userId: event.userId,
            isTyping: event.isTyping,
          },
          ws,
        );
        break;
      case "list-messages":
        this.send(ws, {
          type: "chat:messages",
          roomId: this.roomId,
          messages:
            typeof event.limit === "number"
              ? this.messages.slice(-event.limit)
              : [...this.messages],
        });
        break;
      default:
        this.send(ws, {
          type: "chat:error",
          message: `Unknown event ${(event as { type?: string }).type ?? ""}`,
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
        {
          type: "chat:left",
          roomId: this.roomId,
          userId,
        },
        ws,
      );
    }
  }

  private handleMessage(
    ws: WebSocket,
    event: Extract<ClientEvent, { type: "message" }>,
  ): void {
    if (!event.userId || !event.content) {
      this.send(ws, {
        type: "chat:error",
        message: "userId and content are required",
      });
      return;
    }

    const message: ChatMessageEvent = {
      id: `${this.nextMessageId++}`,
      roomId: this.roomId,
      userId: event.userId,
      content: event.content,
      contentType: event.contentType,
      createdAt: new Date().toISOString(),
    };

    this.messages.push(message);
    if (this.messages.length > 200) {
      this.messages.shift();
    }

    this.broadcast(
      {
        type: "chat:message",
        roomId: this.roomId,
        message,
      },
      undefined,
    );
  }

  private broadcast(event: ServerEvent, sender?: WebSocket): void {
    const payload = JSON.stringify(event);
    for (const socket of this.sockets.keys()) {
      if (socket === sender) {
        continue;
      }
      this.send(socket, payload);
    }
  }

  private send(ws: WebSocket, event: ServerEvent | string): void {
    const payload = typeof event === "string" ? event : JSON.stringify(event);
    try {
      ws.send(payload);
    } catch {
      this.sockets.delete(ws);
    }
  }
}
