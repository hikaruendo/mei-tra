import { NextResponse } from 'next/server';

function getBackendHealthUrl() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) {
    return 'http://localhost:3333/api/health';
  }

  return `${backendUrl.replace(/\/+$/, '').replace(/\/api$/, '')}/api/health`;
}

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(getBackendHealthUrl(), {
      cache: 'no-store',
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout);
  }
}
