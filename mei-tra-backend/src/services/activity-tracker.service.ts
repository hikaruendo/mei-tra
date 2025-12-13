import { Injectable } from '@nestjs/common';
import { ActivityStatus } from '../types/activity.types';
import { IActivityTrackerService } from './interfaces/activity-tracker-service.interface';

@Injectable()
export class ActivityTrackerService implements IActivityTrackerService {
  private readonly IDLE_THRESHOLD_MS = 30 * 60 * 1000; // 30分
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

  getStatus(): ActivityStatus {
    return {
      lastActivity: this.lastActivityTimestamp,
      lastActivityAgo: Date.now() - this.lastActivityTimestamp,
      activeConnections: this.activeConnections,
      isIdle: this.isIdle(),
    };
  }

  isIdle(idleThresholdMs?: number): boolean {
    const threshold = idleThresholdMs ?? this.IDLE_THRESHOLD_MS;
    const idleTime = Date.now() - this.lastActivityTimestamp;
    return idleTime > threshold && this.activeConnections === 0;
  }
}
