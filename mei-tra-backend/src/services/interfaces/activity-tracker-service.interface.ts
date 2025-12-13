import { ActivityStatus } from '../../types/activity.types';

export interface IActivityTrackerService {
  recordActivity(): void;
  incrementConnections(): void;
  decrementConnections(): void;
  getStatus(): ActivityStatus;
  isIdle(idleThresholdMs?: number): boolean;
}
