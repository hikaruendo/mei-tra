import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: number;
  uptime: number;
  activity: {
    lastActivity: number;
    lastActivityAgo: number;
    activeConnections: number;
    isIdle: boolean;
  };
}

export async function GET() {
  const backendBaseUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, '').replace(
      /\/api$/,
      ''
    ) || 'http://localhost:3333';

  const controller = new AbortController();
  // Fly cold start can take several seconds; keep probe long enough to avoid false 503.
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${backendBaseUrl}/api/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Backend health check failed',
          isStarting: true,
        },
        { status: 503 }
      );
    }

    let data: HealthResponse;
    try {
      const text = await response.text();
      data = JSON.parse(text) as HealthResponse;
    } catch {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Backend returned invalid response',
          isStarting: true,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: data.status,
      isIdle: data.activity.isIdle,
      isStarting: false,
      lastActivityAgo: data.activity.lastActivityAgo,
      activeConnections: data.activity.activeConnections,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if ((error as Error).name === 'AbortError') {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Backend health check timeout',
          isStarting: true,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: 'error',
        message: 'Backend is unavailable',
        isStarting: true,
      },
      { status: 503 }
    );
  }
}
