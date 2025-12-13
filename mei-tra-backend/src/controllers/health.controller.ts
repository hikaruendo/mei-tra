import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IActivityTrackerService } from '../services/interfaces/activity-tracker-service.interface';
import { HealthResponse } from '../types/activity.types';

@Controller('health')
export class HealthController {
  private static readonly IDLE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    @Inject('IActivityTrackerService')
    private readonly activityTracker: IActivityTrackerService,
  ) {}

  @Get()
  getHealth(): HealthResponse {
    const activity = this.activityTracker.getStatus();
    const idle = this.activityTracker.isIdle(
      HealthController.IDLE_THRESHOLD_MS,
    );

    const response: HealthResponse = {
      status: idle ? 'degraded' : 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      activity: {
        ...activity,
        isIdle: idle,
      },
    };

    if (response.status !== 'ok') {
      throw new ServiceUnavailableException({
        ...response,
        httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }

    return response;
  }
}
