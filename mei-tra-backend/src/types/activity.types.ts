export interface ActivityStatus {
  lastActivity: number;
  lastActivityAgo: number;
  activeConnections: number;
  isIdle: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: number;
  uptime: number;
  activity: ActivityStatus;
}
