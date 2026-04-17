/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/user-profile/[id]/game-history/route';

describe('app/api/user-profile/[id]/game-history/route', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend.test';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('rejects reads without an authorization header', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/user-profile/user-1/game-history'),
      { params: Promise.resolve({ id: 'user-1' }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authorization header is required',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('proxies authorized recent history reads to the backend', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify([{ roomId: 'room-1' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await GET(
      new NextRequest('http://localhost/api/user-profile/user-1/game-history', {
        headers: { authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: 'user-1' }) },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/api/user-profile/user-1/game-history',
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: 'Bearer token',
        },
      },
    );
    await expect(response.json()).resolves.toEqual([{ roomId: 'room-1' }]);
  });
});
