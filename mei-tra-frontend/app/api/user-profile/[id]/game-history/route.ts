import { NextRequest, NextResponse } from 'next/server';
import type { RecentGameHistoryItemContract } from '@contracts/game-history';
import { getBackendApiUrl } from '@/lib/backend-api';
import { proxyBackendResponse } from '@/lib/api/proxy-backend-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authorization = request.headers.get('authorization');

  if (!authorization) {
    return NextResponse.json(
      { error: 'Authorization header is required' },
      { status: 401 },
    );
  }

  const response = await fetch(getBackendApiUrl(`/user-profile/${id}/game-history`), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: authorization,
    },
  });

  return proxyBackendResponse<RecentGameHistoryItemContract[]>(response);
}
