/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/user-profile/[id]/avatar/route';

describe('app/api/user-profile/[id]/avatar/route', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend.test';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('rejects avatar uploads without an authorization header', async () => {
    const formData = new FormData();
    formData.append('avatar', new Blob(['test'], { type: 'image/png' }), 'avatar.png');

    const response = await POST(
      new NextRequest('http://localhost/api/user-profile/user-1/avatar', {
        method: 'POST',
        body: formData,
      }),
      { params: Promise.resolve({ id: 'user-1' }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authorization header is required',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('forwards avatar uploads to the backend with the bearer token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ avatarUrl: 'http://cdn.test/avatar.webp' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const formData = new FormData();
    formData.append('avatar', new Blob(['test'], { type: 'image/png' }), 'avatar.png');

    const response = await POST(
      new NextRequest('http://localhost/api/user-profile/user-1/avatar', {
        method: 'POST',
        body: formData,
        headers: {
          authorization: 'Bearer token',
        },
      }),
      { params: Promise.resolve({ id: 'user-1' }) },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/api/user-profile/user-1/avatar',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
        },
      }),
    );
    expect((global.fetch as jest.Mock).mock.calls[0]?.[1]?.body).toBeInstanceOf(FormData);
    await expect(response.json()).resolves.toEqual({
      avatarUrl: 'http://cdn.test/avatar.webp',
    });
  });
});
