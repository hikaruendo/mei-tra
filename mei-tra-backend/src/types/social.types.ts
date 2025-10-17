// Value Objects
export class UserId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(value: string): UserId {
    if (!value || value.trim().length === 0) {
      throw new Error('UserId cannot be empty');
    }
    return new UserId(value);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class ChatRoomId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(value: string): ChatRoomId {
    if (!value || value.trim().length === 0) {
      throw new Error('ChatRoomId cannot be empty');
    }
    return new ChatRoomId(value);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ChatRoomId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

// Chat Message Entity
export type ChatContentType = 'text' | 'emoji' | 'system';

export interface ChatMessageProps {
  id: string;
  roomId: ChatRoomId;
  senderId?: UserId;
  content: string;
  contentType: ChatContentType;
  replyTo?: string;
  createdAt: Date;
}

export class ChatMessage {
  private constructor(private readonly props: ChatMessageProps) {}

  static create(props: ChatMessageProps): ChatMessage {
    if (!props.content || props.content.trim().length === 0) {
      throw new Error('Chat message content cannot be empty');
    }
    return new ChatMessage(props);
  }

  getId(): string {
    return this.props.id;
  }

  getRoomId(): ChatRoomId {
    return this.props.roomId;
  }

  getSenderId(): UserId | undefined {
    return this.props.senderId;
  }

  getContent(): string {
    return this.props.content;
  }

  getContentType(): ChatContentType {
    return this.props.contentType;
  }

  getReplyTo(): string | undefined {
    return this.props.replyTo;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      roomId: this.props.roomId.getValue(),
      senderId: this.props.senderId?.getValue(),
      content: this.props.content,
      contentType: this.props.contentType,
      replyTo: this.props.replyTo,
      createdAt: this.props.createdAt.toISOString(),
    };
  }
}

// Chat Room Entity
export type ChatRoomScope = 'global' | 'lobby' | 'table' | 'private';
export type ChatRoomVisibility = 'public' | 'friends' | 'private';

export interface ChatRoomProps {
  id: ChatRoomId;
  scope: ChatRoomScope;
  name?: string;
  ownerId?: UserId;
  visibility: ChatRoomVisibility;
  messageTtlHours: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ChatRoom {
  private constructor(private readonly props: ChatRoomProps) {}

  static create(props: ChatRoomProps): ChatRoom {
    return new ChatRoom(props);
  }

  getId(): ChatRoomId {
    return this.props.id;
  }

  getScope(): ChatRoomScope {
    return this.props.scope;
  }

  getName(): string | undefined {
    return this.props.name;
  }

  getOwnerId(): UserId | undefined {
    return this.props.ownerId;
  }

  getVisibility(): ChatRoomVisibility {
    return this.props.visibility;
  }

  getMessageTtlHours(): number {
    return this.props.messageTtlHours;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id.getValue(),
      scope: this.props.scope,
      name: this.props.name,
      ownerId: this.props.ownerId?.getValue(),
      visibility: this.props.visibility,
      messageTtlHours: this.props.messageTtlHours,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}

// Profile Entity
export interface ProfileProps {
  userId: UserId;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  countryCode?: string;
  rankTier: string;
  rankPoints: number;
  lastOnlineAt: Date;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Profile {
  private constructor(private readonly props: ProfileProps) {}

  static create(props: ProfileProps): Profile {
    return new Profile(props);
  }

  getUserId(): UserId {
    return this.props.userId;
  }

  getDisplayName(): string | undefined {
    return this.props.displayName;
  }

  getAvatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }

  getBio(): string | undefined {
    return this.props.bio;
  }

  getCountryCode(): string | undefined {
    return this.props.countryCode;
  }

  getRankTier(): string {
    return this.props.rankTier;
  }

  getRankPoints(): number {
    return this.props.rankPoints;
  }

  getLastOnlineAt(): Date {
    return this.props.lastOnlineAt;
  }

  getReputationScore(): number {
    return this.props.reputationScore;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  updateDisplayName(displayName: string): Profile {
    return new Profile({
      ...this.props,
      displayName,
      updatedAt: new Date(),
    });
  }

  updateLastOnline(): Profile {
    return new Profile({
      ...this.props,
      lastOnlineAt: new Date(),
      updatedAt: new Date(),
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      userId: this.props.userId.getValue(),
      displayName: this.props.displayName,
      avatarUrl: this.props.avatarUrl,
      bio: this.props.bio,
      countryCode: this.props.countryCode,
      rankTier: this.props.rankTier,
      rankPoints: this.props.rankPoints,
      lastOnlineAt: this.props.lastOnlineAt.toISOString(),
      reputationScore: this.props.reputationScore,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}
