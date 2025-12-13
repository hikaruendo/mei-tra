import { Controller, Get, Inject } from '@nestjs/common';
import { IActivityTrackerService } from './services/interfaces/activity-tracker-service.interface';
import { HealthResponse } from './types/activity.types';

@Controller()
export class AppController {
  constructor(
    @Inject('IActivityTrackerService')
    private readonly activityTracker: IActivityTrackerService,
  ) {}

  @Get()
  getHello(): string {
    return 'NestJS WebSocket Server is Running';
  }

  @Get('health')
  getHealth(): HealthResponse {
    const activityStatus = this.activityTracker.getStatus();

    return {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      activity: activityStatus,
    };
  }
}
