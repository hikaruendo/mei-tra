export interface MobileUserProfile {
  displayName: string;
  username: string;
  avatarUrl?: string;
}

export interface MobileAuthUser {
  id: string;
  email?: string;
  profile: MobileUserProfile | null;
}
