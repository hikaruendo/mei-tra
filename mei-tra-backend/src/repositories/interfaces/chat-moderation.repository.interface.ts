export interface IChatModerationRepository {
  findBlockedUserIds(blockerId: string): Promise<string[]>;
  findUsersBlockingSender(senderId: string): Promise<string[]>;
  blockUser(blockerId: string, blockedId: string): Promise<void>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  createReport(input: {
    reporterId: string;
    reportedSenderId: string;
    messageId: string;
    roomId: string;
    contentSnapshot: string;
    reason: 'offensive' | 'harassment' | 'other';
  }): Promise<void>;
}
