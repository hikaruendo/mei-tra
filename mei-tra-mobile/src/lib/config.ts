const requirePublicEnv = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value.replace(/\/+$/, '');
};

export const config = {
  publicWebBaseUrl: requirePublicEnv(
    'EXPO_PUBLIC_WEB_BASE_URL',
    process.env.EXPO_PUBLIC_WEB_BASE_URL || 'https://meitra.kando1.com',
  ),
  supportUrl: 'https://kando1.com',
  supabaseUrl: requirePublicEnv(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabasePublishableKey: requirePublicEnv(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  backendUrl: requirePublicEnv(
    'EXPO_PUBLIC_BACKEND_URL',
    process.env.EXPO_PUBLIC_BACKEND_URL,
  ),
};
