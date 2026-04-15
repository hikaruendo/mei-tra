const DEFAULT_BACKEND_BASE_URL = 'http://localhost:3333';

function normalizeBackendUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  const trimmed = url.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

export function getBackendBaseUrl(): string {
  return (
    normalizeBackendUrl(process.env.NEXT_PUBLIC_BACKEND_URL) ??
    DEFAULT_BACKEND_BASE_URL
  );
}

export function getBackendApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getBackendBaseUrl()}/api${normalizedPath}`;
}
