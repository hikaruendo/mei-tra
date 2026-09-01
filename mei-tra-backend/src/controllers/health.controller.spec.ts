import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { IDatabaseHealth } from '../database/interfaces/database-health.interface';
import type { IActivityTrackerService } from '../services/interfaces/activity-tracker-service.interface';

describe('HealthController', () => {
  const activityTracker = {
    getStatus: jest.fn().mockReturnValue({
      lastActivity: Date.now(),
      lastActivityAgo: 0,
      activeConnections: 1,
    }),
    isIdle: jest.fn().mockReturnValue(false),
  } as unknown as IActivityTrackerService;

  it('keeps the liveness response independent from database availability', () => {
    const databaseHealth = {
      healthCheck: jest.fn().mockResolvedValue(false),
    } satisfies IDatabaseHealth;
    const controller = new HealthController(activityTracker, databaseHealth);

    expect(controller.getHealth().status).toBe('ok');
    expect(databaseHealth.healthCheck).not.toHaveBeenCalled();
  });

  it('reports database readiness', async () => {
    const databaseHealth = {
      healthCheck: jest.fn().mockResolvedValue(true),
    } satisfies IDatabaseHealth;
    const controller = new HealthController(activityTracker, databaseHealth);

    await expect(controller.getReadiness()).resolves.toMatchObject({
      status: 'ok',
      dependencies: { database: 'ok' },
    });
  });

  it('returns service unavailable when the database is unavailable', async () => {
    const databaseHealth = {
      healthCheck: jest.fn().mockResolvedValue(false),
    } satisfies IDatabaseHealth;
    const controller = new HealthController(activityTracker, databaseHealth);

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
