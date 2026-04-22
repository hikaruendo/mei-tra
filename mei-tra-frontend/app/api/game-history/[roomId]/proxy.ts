import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/backend-api';

async function proxyResponse(response: Response): Promise<NextResponse> {
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

export async function proxyGameHistoryRequest(
  request: NextRequest,
  roomId: string,
  resource: 'replay' | 'summary',
): Promise<NextResponse> {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return NextResponse.json(
      { error: 'Authorization header is required' },
      { status: 401 },
    );
  }

  const response = await fetch(
    `${getBackendApiUrl(`/game-history/${roomId}/${resource}`)}${request.nextUrl.search}`,
    {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: authorization,
      },
    },
  );

  return proxyResponse(response);
}
