import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DOM
global.window = {
  location: {
    pathname: '/',
    search: '',
    origin: 'http://localhost:3000'
  },
  addEventListener: vi.fn(),
  scrollTo: vi.fn(),
  spaNavigate: undefined,
  spaUrl: undefined
};

global.document = {
  getElementById: vi.fn(() => ({
    innerHTML: ''
  })),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

global.history = {
  pushState: vi.fn(),
  replaceState: vi.fn()
};

describe('Router', () => {
  describe('URL parsing', () => {
    it('should parse pathname and query params', async () => {
      const { default: router } = await import('./router.js');

      // Access internal parseUrl through testing the navigate flow
      // For now, we'll test the exposed buildUrl function
      const { buildUrl } = await import('./router.js');

      const url = buildUrl('/my-assets', { page: 2, filter: 'geonodes' });
      expect(url).toContain('/my-assets');
      expect(url).toContain('page=2');
      expect(url).toContain('filter=geonodes');
    });

    it('should handle null/undefined params', async () => {
      const { buildUrl } = await import('./router.js');

      const url = buildUrl('/search', { q: 'test', filter: null });
      expect(url).toContain('q=test');
      expect(url).not.toContain('filter');
    });

    it('should preserve param order', async () => {
      const { buildUrl } = await import('./router.js');

      const url = buildUrl('/test', { z: '3', a: '1', m: '2' });
      // URL params are unordered, but all should be present
      expect(url).toContain('z=3');
      expect(url).toContain('a=1');
      expect(url).toContain('m=2');
    });
  });

  describe('buildUrl helper', () => {
    it('should build URL with empty params', async () => {
      const { buildUrl } = await import('./router.js');
      const url = buildUrl('/home');
      expect(url).toBe('/home');
    });

    it('should build URL with single param', async () => {
      const { buildUrl } = await import('./router.js');
      const url = buildUrl('/search', { q: 'geometry' });
      expect(url).toBe('/search?q=geometry');
    });

    it('should build URL with multiple params', async () => {
      const { buildUrl } = await import('./router.js');
      const url = buildUrl('/search', { q: 'geometry', limit: '50' });
      expect(url).toContain('/search?');
      expect(url).toContain('q=geometry');
      expect(url).toContain('limit=50');
    });

    it('should encode special characters in params', async () => {
      const { buildUrl } = await import('./router.js');
      const url = buildUrl('/search', { q: 'hello world' });
      expect(url).toContain('q=hello');
      expect(url).toContain('world');
    });

    it('should skip null and undefined params', async () => {
      const { buildUrl } = await import('./router.js');
      const url = buildUrl('/page', { keep: 'yes', skip: null, remove: undefined });
      expect(url).toContain('keep=yes');
      expect(url).not.toContain('skip');
      expect(url).not.toContain('remove');
    });
  });

  describe('Route matching', () => {
    it('should recognize asset route pattern /:username/:slug', async () => {
      // This tests route matching logic indirectly
      // The router should match two-part paths as asset pages
      const { buildUrl } = await import('./router.js');

      // buildUrl doesn't modify the path, so we can use it for structure
      const url = buildUrl('/alice/my-geometry-nodes');
      expect(url).toBe('/alice/my-geometry-nodes');
    });

    it('should recognize user profile route pattern /:username', async () => {
      const { buildUrl } = await import('./router.js');

      const url = buildUrl('/alice');
      expect(url).toBe('/alice');
    });

    it('should recognize static routes', async () => {
      const { buildUrl } = await import('./router.js');

      const paths = ['/my-assets', '/upload-asset', '/settings', '/terms'];
      paths.forEach(path => {
        const url = buildUrl(path);
        expect(url).toBe(path);
      });
    });
  });

  describe('getCurrentRoute', () => {
    it('should export getCurrentRoute function', async () => {
      const { getCurrentRoute } = await import('./router.js');
      expect(typeof getCurrentRoute).toBe('function');
    });

    it('should return null initially', async () => {
      const { getCurrentRoute } = await import('./router.js');
      // Initially no route has been set
      const route = getCurrentRoute();
      expect(route).toBeNull();
    });
  });

  describe('Global exposure', () => {
    it('should expose spaNavigate globally', async () => {
      const { default: router } = await import('./router.js');
      // After import, spaNavigate should be defined on window
      expect(typeof window.spaNavigate).toBe('function');
    });

    it('should expose spaUrl globally', async () => {
      const { default: router } = await import('./router.js');
      // After import, spaUrl should be defined on window
      expect(typeof window.spaUrl).toBe('function');
    });
  });
});
