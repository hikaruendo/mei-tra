import supabaseConfig from './supabase.config';

describe('supabaseConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      SUPABASE_URL_DEV: 'http://127.0.0.1:54321',
      SUPABASE_ANON_KEY_DEV: 'dev-anon',
      SUPABASE_SERVICE_ROLE_KEY_DEV: 'dev-service',
      SUPABASE_URL_PROD: 'https://prod-project.supabase.co',
      SUPABASE_ANON_KEY_PROD: 'prod-anon',
      SUPABASE_SERVICE_ROLE_KEY_PROD: 'prod-service',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses development Supabase settings outside production', () => {
    expect(supabaseConfig()).toEqual({
      url: 'http://127.0.0.1:54321',
      anonKey: 'dev-anon',
      serviceRoleKey: 'dev-service',
    });
  });

  it('uses production Supabase settings in production', () => {
    process.env.NODE_ENV = 'production';

    expect(supabaseConfig()).toEqual({
      url: 'https://prod-project.supabase.co',
      anonKey: 'prod-anon',
      serviceRoleKey: 'prod-service',
    });
  });

  it('rejects a missing production Supabase URL in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SUPABASE_URL_PROD;

    expect(() => supabaseConfig()).toThrow(
      'SUPABASE_URL_PROD is required in production.',
    );
  });

  it('rejects a production Supabase URL that matches the development URL', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL_PROD = 'http://127.0.0.1:54321/';

    expect(() => supabaseConfig()).toThrow(
      'SUPABASE_URL_PROD must not point to the same database as SUPABASE_URL_DEV.',
    );
  });

  it('rejects local or private production Supabase URLs', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL_PROD = 'http://localhost:54321';

    expect(() => supabaseConfig()).toThrow(
      'Refusing to start production with a local or private SUPABASE_URL_PROD.',
    );
  });

  it('rejects malformed production Supabase URLs', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL_PROD = 'not-a-url';

    expect(() => supabaseConfig()).toThrow(
      'SUPABASE_URL_PROD must be a valid URL.',
    );
  });
});
