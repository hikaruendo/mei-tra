import { NextResponse } from 'next/server';

/** Passes a backend response through an API route with its status and content type. */
export async function proxyBackendResponse<T = unknown>(
  response: Response,
): Promise<NextResponse<T>> {
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
