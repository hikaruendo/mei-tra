import { NextResponse } from 'next/server';

const BACKEND_HEALTH_URL = process.env.NEXT_PUBLIC_BACKEND_URL
  ? `${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/+$/, '').replace(/\/api$/, '')}/api/health`
  : 'http://localhost:3333/api/health';

export async function GET() {
  try {
    const response = await fetch(BACKEND_HEALTH_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: 'error', isIdle: false, isStarting: true },
        { status: 200 }
      );
    }

    const data = await response.json();
    // Backend returns: { status, activity: { isIdle, lastActivityAgo, activeConnections } }
    const activity = data.activity ?? {};

    return NextResponse.json({
      status: data.status ?? 'error',
      isIdle: activity.isIdle ?? false,
      isStarting: false,
      lastActivityAgo: activity.lastActivityAgo,
      activeConnections: activity.activeConnections,
    });
  } catch {
    // Backend unreachable (cold start / scaling up)
    return NextResponse.json(
      { status: 'error', isIdle: false, isStarting: true },
      { status: 200 }
    );
  }
}
