/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET } from '@/app/[locale]/auth/callback/route';

const mockExchangeCodeForSession = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(async () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

describe('app/[locale]/auth/callback/route', () => {
  beforeEach(() => {
    mockExchangeCodeForSession.mockReset();
  });

  it('redirects to the locale-aware next path after a successful code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(
      new NextRequest('http://localhost/en/auth/callback?code=abc&next=/profile'),
      { params: Promise.resolve({ locale: 'en' }) },
    );

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/en/profile');
  });

  it('redirects to the locale-aware login page when the code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: new Error('callback failed'),
    });

    const response = await GET(
      new NextRequest('http://localhost/en/auth/callback?code=abc'),
      { params: Promise.resolve({ locale: 'en' }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/en/auth/login?error=auth_callback_failed',
    );
  });

  it('keeps the default locale callback path unprefixed', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(
      new NextRequest('http://localhost/auth/callback?code=abc&next=/rooms'),
      { params: Promise.resolve({ locale: 'ja' }) },
    );

    expect(response.headers.get('location')).toBe('http://localhost/rooms');
  });
});
