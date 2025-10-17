export interface BasicProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  countryCode?: string;
  rankTier: string;
}

export interface ChatMessage {
  id: string;
  sender: BasicProfile;
  content: string;
  contentType: 'text' | 'emoji' | 'system';
  createdAt: string;
  replyTo?: string;
}

export interface PresenceEvent {
  type: 'presence.update';
  userId: string;
  status: 'online' | 'idle' | 'playing';
  tableId?: string;
  lastSeenAt: string;
}

export interface FriendEvent {
  type: 'friend.request' | 'friend.status';
  requestId: string;
  fromUser: BasicProfile;
  status?: 'accepted' | 'rejected';
  createdAt: string;
}

export interface ChatMessageEvent {
  type: 'chat.message';
  roomId: string;
  message: ChatMessage;
}

export interface ChatTypingEvent {
  type: 'chat.typing';
  roomId: string;
  userId: string;
  startedAt: string;
}

export interface ReplayPublishedEvent {
  type: 'replay.published';
  replayId: string;
  tableId: string;
  visibility: 'public' | 'friends' | 'private';
  createdAt: string;
}

export interface LeaderboardUpdatedEvent {
  type: 'leaderboard.updated';
  period: 'weekly' | 'season' | 'all_time';
  snapshotId: string;
  generatedAt: string;
}

export interface NotificationPayload {
  id: string;
  type: 'friend_request' | 'invite' | 'chat_mention' | 'system';
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationEvent {
  type: 'notification.push';
  notification: NotificationPayload;
}

export type SocialEvent =
  | PresenceEvent
  | FriendEvent
  | ChatMessageEvent
  | ChatTypingEvent
  | ReplayPublishedEvent
  | LeaderboardUpdatedEvent
  | NotificationEvent;
