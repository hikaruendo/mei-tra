import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DATABASE_HEALTH,
  type IDatabaseHealth,
} from '../database/interfaces/database-health.interface';
import { IActivityTrackerService } from '../services/interfaces/activity-tracker-service.interface';
import { HealthResponse, ReadinessResponse } from '../types/activity.types';

@Controller('health')
export class HealthController {
  private static readonly IDLE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    @Inject('IActivityTrackerService')
    private readonly activityTracker: IActivityTrackerService,
    @Inject(DATABASE_HEALTH)
    private readonly databaseHealth: IDatabaseHealth,
  ) {}

  @Get()
  getHealth(): HealthResponse {
    return this.buildHealthResponse();
  }

  @Get('readiness')
  async getReadiness(): Promise<ReadinessResponse> {
    const response = this.buildHealthResponse();
    if (!(await this.databaseHealth.healthCheck())) {
      throw new ServiceUnavailableException({
        ...response,
        status: 'error',
        dependencies: { database: 'error' },
      });
    }

    return {
      ...response,
      dependencies: { database: 'ok' },
    };
  }

  private buildHealthResponse(): HealthResponse {
    const activity = this.activityTracker.getStatus();
    const idle = this.activityTracker.isIdle(
      HealthController.IDLE_THRESHOLD_MS,
    );

    const mem = process.memoryUsage();
    const response: HealthResponse = {
      status: idle ? 'degraded' : 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      activity: {
        ...activity,
        isIdle: idle,
      },
      memory: {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024),
      },
    };

    return response;
  }
}
