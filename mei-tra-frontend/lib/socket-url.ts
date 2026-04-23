const DEFAULT_SOCKET_BASE_URL = 'http://localhost:3333';

function trimApiSuffix(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

function upgradeHttpOnSecurePage(url: string): string {
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    url.startsWith('http://')
  ) {
    return `https://${url.slice('http://'.length)}`;
  }

  return url;
}

export function normalizeSocketBaseUrl(url: string | undefined): string {
  const rawUrl = url?.trim() || DEFAULT_SOCKET_BASE_URL;
  return upgradeHttpOnSecurePage(trimApiSuffix(rawUrl));
}

export function getSocketBaseUrl(): string {
  return normalizeSocketBaseUrl(
    process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL,
  );
}
