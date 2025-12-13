import { Controller, Get } from '@nestjs/common';
import { ActivityTrackerService } from './services/activity-tracker.service';

@Controller()
export class AppController {
  constructor(private readonly activityTracker: ActivityTrackerService) {}

  @Get()
  getHello(): string {
    return 'NestJS WebSocket Server is Running';
  }

  @Get('health')
  getHealth() {
    const activityStatus = this.activityTracker.getStatus();

    return {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      activity: {
        lastActivityTimestamp: activityStatus.lastActivity,
        lastActivityAgo: activityStatus.lastActivityAgo,
        activeConnections: activityStatus.activeConnections,
        isIdle: activityStatus.isIdle,
      },
    };
  }
}
