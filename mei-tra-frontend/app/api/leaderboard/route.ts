import { NextRequest, NextResponse } from 'next/server';
import { isGameMode } from '@contracts/room';
import { getBackendApiUrl } from '@/lib/backend-api';
import { proxyBackendResponse } from '@/lib/api/proxy-backend-response';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
  }
  const mode = request.nextUrl.searchParams.get('mode');
  if (!isGameMode(mode)) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }
  const response = await fetch(getBackendApiUrl(`/leaderboard?mode=${mode}`), {
    headers: { Authorization: authorization },
    cache: 'no-store',
  });
  return proxyBackendResponse(response);
}
