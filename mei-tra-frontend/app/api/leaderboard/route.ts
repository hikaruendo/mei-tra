import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/backend-api';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
  }
  const mode = request.nextUrl.searchParams.get('mode');
  if (mode !== 'normal' && mode !== 'pro') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }
  const response = await fetch(getBackendApiUrl(`/leaderboard?mode=${mode}`), {
    headers: { Authorization: authorization },
    cache: 'no-store',
  });
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
}
