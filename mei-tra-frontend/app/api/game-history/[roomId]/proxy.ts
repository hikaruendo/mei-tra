import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/backend-api';

async function proxyResponse<T>(response: Response): Promise<NextResponse<T>> {
  const contentType =
    response.headers.get('content-type') ?? 'application/json; charset=utf-8';
  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      'content-type': contentType,
    },
  });
}

export async function proxyGameHistoryRequest<T>(
  request: NextRequest,
  roomId: string,
  resource: 'replay' | 'summary',
): Promise<NextResponse<T>> {
  const response = await fetch(
    `${getBackendApiUrl(`/game-history/${roomId}/${resource}`)}${request.nextUrl.search}`,
    {
      method: 'GET',
      cache: 'no-store',
    },
  );

  return proxyResponse<T>(response);
}
