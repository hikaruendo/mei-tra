/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/user-profile/[id]/route';

describe('app/api/user-profile/[id]/route', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend.test';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('proxies profile reads to the backend', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ id: 'user-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await GET(
      new NextRequest('http://localhost/api/user-profile/user-1'),
      { params: Promise.resolve({ id: 'user-1' }) },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/api/user-profile/user-1',
      { method: 'GET', cache: 'no-store' },
    );
    await expect(response.json()).resolves.toEqual({ id: 'user-1' });
  });

  it('rejects profile writes without an authorization header', async () => {
    const response = await PUT(
      new NextRequest('http://localhost/api/user-profile/user-1', {
        method: 'PUT',
        body: JSON.stringify({ displayName: 'Alice' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'user-1' }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authorization header is required',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('forwards authorized profile writes to the backend', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ id: 'user-1', displayName: 'Alice' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await PUT(
      new NextRequest('http://localhost/api/user-profile/user-1', {
        method: 'PUT',
        body: JSON.stringify({ displayName: 'Alice' }),
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
      }),
      { params: Promise.resolve({ id: 'user-1' }) },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/api/user-profile/user-1',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: 'Alice' }),
      },
    );
    await expect(response.json()).resolves.toEqual({
      id: 'user-1',
      displayName: 'Alice',
    });
  });
});
