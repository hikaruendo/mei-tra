import { normalizeSocketBaseUrl } from '@/lib/socket-url';

describe('normalizeSocketBaseUrl', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('uses localhost when no URL is configured', () => {
    expect(normalizeSocketBaseUrl(undefined)).toBe('http://localhost:3333');
  });

  it('removes trailing slash and /api suffix', () => {
    expect(normalizeSocketBaseUrl('https://api.example.com/api/')).toBe(
      'https://api.example.com',
    );
  });

  it('upgrades http URLs on https pages', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { protocol: 'https:' },
    });

    expect(normalizeSocketBaseUrl('http://api.example.com')).toBe(
      'https://api.example.com',
    );
  });

  it('keeps http URLs on local http pages', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { protocol: 'http:' },
    });

    expect(normalizeSocketBaseUrl('http://localhost:3333')).toBe(
      'http://localhost:3333',
    );
  });
});
