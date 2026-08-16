export interface MobileUserProfile {
  displayName: string;
  username: string;
  avatarUrl?: string;
  /** Defaults to true for profiles saved before the setting existed. */
  startPlayerAnimation: boolean;
}

export interface MobileAuthUser {
  id: string;
  email?: string;
  profile: MobileUserProfile | null;
}
