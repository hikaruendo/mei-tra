import { Injectable } from '@nestjs/common';

@Injectable()
export class ActivityTrackerService {
  private lastActivityTimestamp: number = Date.now();
  private activeConnections: number = 0;

  recordActivity(): void {
    this.lastActivityTimestamp = Date.now();
  }

  incrementConnections(): void {
    this.activeConnections++;
    this.recordActivity();
  }

  decrementConnections(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  getStatus() {
    return {
      lastActivity: this.lastActivityTimestamp,
      lastActivityAgo: Date.now() - this.lastActivityTimestamp,
      activeConnections: this.activeConnections,
      isIdle: this.isIdle(),
    };
  }

  isIdle(idleThresholdMs: number = 30 * 60 * 1000): boolean {
    const idleTime = Date.now() - this.lastActivityTimestamp;
    return idleTime > idleThresholdMs && this.activeConnections === 0;
  }
}
