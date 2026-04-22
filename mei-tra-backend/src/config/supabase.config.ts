import { registerAs } from '@nestjs/config';

const LOCAL_SUPABASE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

const normalizeUrl = (value?: string): string | undefined =>
  value?.trim().replace(/\/+$/, '');

const assertProductionSupabaseUrl = (
  productionUrl?: string,
  developmentUrl?: string,
) => {
  const normalizedProductionUrl = normalizeUrl(productionUrl);

  if (!normalizedProductionUrl) {
    throw new Error('SUPABASE_URL_PROD is required in production.');
  }

  const normalizedDevelopmentUrl = normalizeUrl(developmentUrl);
  if (
    normalizedDevelopmentUrl &&
    normalizedProductionUrl === normalizedDevelopmentUrl
  ) {
    throw new Error(
      'SUPABASE_URL_PROD must not point to the same database as SUPABASE_URL_DEV.',
    );
  }

  let hostname: string;
  try {
    hostname = new URL(normalizedProductionUrl).hostname.toLowerCase();
  } catch {
    throw new Error('SUPABASE_URL_PROD must be a valid URL.');
  }

  const isLocalOrPrivateHost =
    LOCAL_SUPABASE_HOSTS.has(hostname) ||
    hostname.endsWith('.local') ||
    PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname));

  if (isLocalOrPrivateHost) {
    throw new Error(
      'Refusing to start production with a local or private SUPABASE_URL_PROD.',
    );
  }
};

export default registerAs('supabase', () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const useDevConfig = !isProduction; // Use dev config for development and test

  if (isProduction) {
    assertProductionSupabaseUrl(
      process.env.SUPABASE_URL_PROD,
      process.env.SUPABASE_URL_DEV,
    );
  }

  const config = {
    url: useDevConfig
      ? process.env.SUPABASE_URL_DEV
      : process.env.SUPABASE_URL_PROD,
    anonKey: useDevConfig
      ? process.env.SUPABASE_ANON_KEY_DEV
      : process.env.SUPABASE_ANON_KEY_PROD,
    serviceRoleKey: useDevConfig
      ? process.env.SUPABASE_SERVICE_ROLE_KEY_DEV
      : process.env.SUPABASE_SERVICE_ROLE_KEY_PROD,
  };

  return config;
});
