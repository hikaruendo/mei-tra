export interface MobileUserProfile {
  displayName: string;
  username: string;
  avatarUrl?: string;
  /** Defaults to true for profiles saved before sound effects existed. */
  sound: boolean;
  /** Defaults to true for profiles saved before the setting existed. */
  startPlayerAnimation: boolean;
}

export interface MobileAuthUser {
  id: string;
  email?: string;
  /** Supabase anonymous (guest) session; upgrading via updateUser keeps the same id. */
  isAnonymous?: boolean;
  profile: MobileUserProfile | null;
}
