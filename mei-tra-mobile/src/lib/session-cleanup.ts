export interface SessionCleanupDependencies {
  getAccessToken: () => Promise<string | null>;
  unregisterPushToken: (accessToken: string | null) => Promise<unknown>;
  clearRoom: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const cleanupBeforeLocalSignOut = async ({
  getAccessToken,
  unregisterPushToken,
  clearRoom,
  signOut,
}: SessionCleanupDependencies): Promise<void> => {
  const accessToken = await getAccessToken().catch(() => null);
  await unregisterPushToken(accessToken).catch(() => undefined);
  await clearRoom();
  await signOut();
};

export interface AccountDeletionCleanupDependencies {
  clearLocalNotificationRegistration: () => Promise<void>;
  clearRoom: () => Promise<void>;
  clearLocalSession: () => Promise<void>;
}

export const cleanupAfterAccountDeletion = async ({
  clearLocalNotificationRegistration,
  clearRoom,
  clearLocalSession,
}: AccountDeletionCleanupDependencies): Promise<void> => {
  await clearLocalNotificationRegistration().catch(() => undefined);
  await clearRoom().catch(() => undefined);
  await clearLocalSession().catch(() => undefined);
};
