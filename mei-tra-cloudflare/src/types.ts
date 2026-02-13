export interface BasicProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  countryCode?: string;
  rankTier: string;
}

export type ClientEvent =
  | { type: 'join' }
  | { type: 'leave' }
  | { type: 'message'; content: string; contentType?: string; replyTo?: string }
  | { type: 'typing'; isTyping: boolean }
  | { type: 'list-messages'; limit?: number; cursor?: string };

export type ChatMessageEvent = {
  id: string;
  roomId: string;
  sender: BasicProfile;
  content: string;
  contentType: 'text' | 'emoji' | 'system';
  createdAt: string;
  replyTo?: string;
};

export type ServerEvent =
  | { type: 'chat:joined'; roomId: string; userId: string }
  | { type: 'chat:left'; roomId: string; userId: string }
  | { type: 'chat:message'; roomId: string; message: ChatMessageEvent }
  | { type: 'chat:messages'; roomId: string; messages: ChatMessageEvent[] }
  | { type: 'chat:typing'; roomId: string; userId: string; isTyping: boolean }
  | { type: 'chat:error'; message: string };
