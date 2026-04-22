/** @jest-environment node */

import { GET } from '@/app/api/game-history/[roomId]/replay/route';
import { NextRequest } from 'next/server';

describe('GET /api/game-history/[roomId]/replay', () => {
  const originalBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend.test';
    global.fetch = jest.fn().mockResolvedValue(
      new Response('{"roomId":"room-1","totalEntries":0,"rounds":[]}', {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      }),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_URL = originalBackendUrl;
    jest.resetAllMocks();
  });

  it('proxies replay requests to the backend API with query params', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/game-history/room-1/replay?limit=50&roundNumber=2',
      {
        headers: {
          authorization: 'Bearer token-1',
        },
      },
    );

    const response = await GET(request, {
      params: Promise.resolve({ roomId: 'room-1' }),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/api/game-history/room-1/replay?limit=50&roundNumber=2',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: 'Bearer token-1',
        },
      }),
    );
    expect(response.status).toBe(200);
  });

  it('rejects requests without an authorization header', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/game-history/room-1/replay',
    );

    const response = await GET(request, {
      params: Promise.resolve({ roomId: 'room-1' }),
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });
});
