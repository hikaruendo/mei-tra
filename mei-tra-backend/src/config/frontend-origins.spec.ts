import {
  createSocketCorsOriginHandler,
  getFrontendOriginAllowlist,
  isAllowedFrontendOrigin,
} from './frontend-origins';

describe('frontend origins', () => {
  const originalDev = process.env.FRONTEND_URL_DEV;
  const originalProd = process.env.FRONTEND_URL_PROD;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.FRONTEND_URL_DEV = 'http://localhost:3000/';
    process.env.FRONTEND_URL_PROD = 'https://meitra.example.com/app';
  });

  afterEach(() => {
    process.env.FRONTEND_URL_DEV = originalDev;
    process.env.FRONTEND_URL_PROD = originalProd;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('builds a normalized allowlist from dev and prod env vars', () => {
    expect(getFrontendOriginAllowlist()).toEqual([
      'http://localhost:3000',
      'https://meitra.example.com',
    ]);
  });

  it('allows configured local and production origins', () => {
    expect(isAllowedFrontendOrigin('http://localhost:3000')).toBe(true);
    expect(isAllowedFrontendOrigin('https://meitra.example.com')).toBe(true);
  });

  it('allows alternate localhost ports outside production', () => {
    process.env.NODE_ENV = 'development';

    expect(isAllowedFrontendOrigin('http://localhost:3001')).toBe(true);
    expect(isAllowedFrontendOrigin('http://127.0.0.1:3001')).toBe(true);
  });

  it('rejects alternate localhost ports in production', () => {
    process.env.NODE_ENV = 'production';

    expect(isAllowedFrontendOrigin('http://localhost:3001')).toBe(false);
  });

  it('rejects unknown origins', () => {
    expect(isAllowedFrontendOrigin('https://preview.example.com')).toBe(false);
    expect(isAllowedFrontendOrigin(undefined)).toBe(false);
  });

  it('returns an error for unknown socket origins', () => {
    const handler = createSocketCorsOriginHandler();
    const callback = jest.fn();

    handler('https://preview.example.com', callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });
});
