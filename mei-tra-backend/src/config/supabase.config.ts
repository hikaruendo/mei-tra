import { registerAs } from '@nestjs/config';

export default registerAs('supabase', () => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  console.log('🔧 Supabase Config Debug:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('isDevelopment:', isDevelopment);
  console.log('SUPABASE_URL_DEV:', process.env.SUPABASE_URL_DEV);
  console.log(
    'SUPABASE_SERVICE_ROLE_KEY_DEV:',
    process.env.SUPABASE_SERVICE_ROLE_KEY_DEV ? '[SET]' : '[MISSING]',
  );

  const config = {
    url: isDevelopment
      ? process.env.SUPABASE_URL_DEV
      : process.env.SUPABASE_URL_PROD,
    anonKey: isDevelopment
      ? process.env.SUPABASE_ANON_KEY_DEV
      : process.env.SUPABASE_ANON_KEY_PROD,
    serviceRoleKey: isDevelopment
      ? process.env.SUPABASE_SERVICE_ROLE_KEY_DEV
      : process.env.SUPABASE_SERVICE_ROLE_KEY_PROD,
  };

  console.log('Final config:', {
    url: config.url,
    serviceRoleKey: config.serviceRoleKey ? '[SET]' : '[MISSING]',
  });
  return config;
});
