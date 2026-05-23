function normalizeOrigin(origin: string | undefined): string | null {
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/+$/, '');
  }
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function getFrontendOriginAllowlist(): string[] {
  const candidates = [
    normalizeOrigin(process.env.FRONTEND_URL_DEV),
    normalizeOrigin(process.env.FRONTEND_URL_PROD),
  ].filter((origin): origin is string => Boolean(origin));

  return [...new Set(candidates)];
}

export function isAllowedFrontendOrigin(origin?: string): boolean {
  if (!origin) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  return (
    getFrontendOriginAllowlist().includes(normalizedOrigin) ||
    isLocalDevelopmentOrigin(normalizedOrigin)
  );
}

export function createSocketCorsOriginHandler() {
  return (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ): void => {
    if (isAllowedFrontendOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  };
}
