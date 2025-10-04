import { registerAs } from '@nestjs/config';

export default registerAs('supabase', () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const useDevConfig = !isProduction; // Use dev config for development and test

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
