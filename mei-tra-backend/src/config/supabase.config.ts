import { registerAs } from '@nestjs/config';

export default registerAs('supabase', () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const useDevConfig = !isProduction; // Use dev config for development and test

  // Only log debug info in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Supabase Config Debug:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('useDevConfig:', useDevConfig);
    console.log('SUPABASE_URL_DEV:', process.env.SUPABASE_URL_DEV);
    console.log(
      'SUPABASE_SERVICE_ROLE_KEY_DEV:',
      process.env.SUPABASE_SERVICE_ROLE_KEY_DEV ? '[SET]' : '[MISSING]',
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

  if (process.env.NODE_ENV === 'development') {
    console.log('Final config:', {
      url: config.url,
      serviceRoleKey: config.serviceRoleKey ? '[SET]' : '[MISSING]',
    });
  }

  return config;
});
