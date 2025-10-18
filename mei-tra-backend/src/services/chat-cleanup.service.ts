import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IChatMessageRepository } from '../repositories/interfaces/chat-message.repository.interface';

@Injectable()
export class ChatCleanupService {
  private readonly logger = new Logger(ChatCleanupService.name);

  constructor(
    @Inject('IChatMessageRepository')
    private readonly chatMessageRepository: IChatMessageRepository,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldMessages(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const deletedCount =
        await this.chatMessageRepository.deleteMessagesBefore(cutoffDate);
      this.logger.log(
        `Cleaned up ${deletedCount} old chat messages (older than ${cutoffDate.toISOString()})`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup old messages:', error);
    }
  }
}
