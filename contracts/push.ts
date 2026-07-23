export const PUSH_PLATFORMS = ["ios", "android"] as const;

export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export interface RegisterPushTokenInput {
  deviceId: string;
  platform: PushPlatform;
  expoPushToken: string;
  appVersion?: string;
}

export interface DeletePushTokenInput {
  deviceId: string;
  platform: PushPlatform;
}

export interface PushTokenRegistration {
  id: string;
  deviceId: string;
  platform: PushPlatform;
  appVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameStartedPushPayload {
  eventId: string;
  roomId: string;
  roundNumber: number;
}

export interface TurnPushPayload {
  eventId: string;
  roomId: string;
  roundNumber: number;
  phase: "blow" | "play";
}

export interface PushNotificationResult {
  targetedTokenCount: number;
  acceptedTokenCount: number;
  rejectedTokenCount: number;
  invalidTokenCount: number;
  removedTokenCount: number;
}
