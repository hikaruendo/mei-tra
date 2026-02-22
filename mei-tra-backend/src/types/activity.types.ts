export interface ActivityStatus {
  lastActivity: number;
  lastActivityAgo: number;
  activeConnections: number;
  isIdle: boolean;
}

export interface MemoryInfo {
  heapUsed: number;
  heapTotal: number;
  rss: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: number;
  uptime: number;
  activity: ActivityStatus;
  memory: MemoryInfo;
}
