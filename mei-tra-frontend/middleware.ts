import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match only internationalized pathnames
  matcher: [
    '/',
    '/(ja|en)/:path*',
    // Match all pathnames except for API routes, static files, etc.
    '/((?!api|backend-status|_next|_vercel|.*\\..*).*)'
  ]
};
