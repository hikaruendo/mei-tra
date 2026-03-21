import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  const host = request.headers.get('host') ?? '';

  if (host.endsWith('.vercel.app')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return response;
}

export const config = {
  // Match only internationalized pathnames
  matcher: [
    '/',
    '/(ja|en)/:path*',
    // Match all pathnames except for API routes, static files, etc.
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
