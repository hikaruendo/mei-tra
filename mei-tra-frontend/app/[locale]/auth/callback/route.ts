import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

function buildLocalizedPath(locale: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (locale === 'ja') {
    return normalizedPath;
  }

  return `/${locale}${normalizedPath}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const code = request.nextUrl.searchParams.get('code');
  const nextPath = request.nextUrl.searchParams.get('next') ?? '/';
  const safeNextPath = nextPath.startsWith('/') ? nextPath : '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(
        new URL(buildLocalizedPath(locale, safeNextPath), request.url),
      );
    }
  }

  const errorUrl = new URL(
    buildLocalizedPath(locale, '/auth/login'),
    request.url,
  );
  errorUrl.searchParams.set('error', 'auth_callback_failed');

  return NextResponse.redirect(errorUrl);
}
