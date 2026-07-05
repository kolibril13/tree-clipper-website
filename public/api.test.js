import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock auth.js BEFORE importing api.js
vi.mock('./auth.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null }
      })
    }
  }
}));

import { APIError } from './api.js';

describe('API Client', () => {
  beforeEach(() => {
    fetch.mockClear();
    vi.clearAllMocks();
  });

  describe('APIError', () => {
    it('should create error with message, status, and body', () => {
      const err = new APIError('Test error', 404, { detail: 'Not found' });
      expect(err.message).toBe('Test error');
      expect(err.status).toBe(404);
      expect(err.body).toEqual({ detail: 'Not found' });
      expect(err.name).toBe('APIError');
    });

    it('should be instanceof Error', () => {
      const err = new APIError('Test', 500, null);
      expect(err instanceof Error).toBe(true);
    });
  });

  describe('Request handling', () => {
    it('should handle successful JSON response', async () => {
      const { users } = await import('./api.js');

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ id: '123', username: 'alice' })
      });

      const result = await users.check('alice');
      expect(result).toEqual({ id: '123', username: 'alice' });
    });

    it('should handle text response', async () => {
      const { users } = await import('./api.js');

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'text/plain']]),
        text: async () => 'Success'
      });

      const result = await users.check('alice');
      expect(result).toBe('Success');
    });

    it('should throw APIError on 404', async () => {
      const { users } = await import('./api.js');

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ message: 'User not found' })
      });

      await expect(users.check('nonexistent')).rejects.toThrow('User not found');
    });

    it('should throw APIError on 500', async () => {
      const { users } = await import('./api.js');

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ detail: 'Internal error' })
      });

      try {
        await users.check('alice');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err instanceof APIError).toBe(true);
        expect(err.status).toBe(500);
      }
    });

    it('should handle network error', async () => {
      const { users } = await import('./api.js');

      fetch.mockRejectedValueOnce(new Error('Network failed'));

      await expect(users.check('alice')).rejects.toThrow('Network failed');
    });
  });

  describe('Endpoint grouping', () => {
    it('should export users, entries, slugs groups', async () => {
      const api = await import('./api.js');
      expect(typeof api.users).toBe('object');
      expect(typeof api.entries).toBe('object');
      expect(typeof api.slugs).toBe('object');
    });

    it('users group should have expected methods', async () => {
      const { users } = await import('./api.js');
      expect(typeof users.getMe).toBe('function');
      expect(typeof users.check).toBe('function');
      expect(typeof users.claim).toBe('function');
      expect(typeof users.delete).toBe('function');
    });

    it('entries group should have expected methods', async () => {
      const { entries } = await import('./api.js');
      expect(typeof entries.list).toBe('function');
      expect(typeof entries.listMine).toBe('function');
      expect(typeof entries.get).toBe('function');
      expect(typeof entries.create).toBe('function');
    });

    it('slugs group should have check method', async () => {
      const { slugs } = await import('./api.js');
      expect(typeof slugs.check).toBe('function');
    });
  });

  describe('Query parameters', () => {
    it('should append query params for GET requests', async () => {
      const { entries } = await import('./api.js');

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => []
      });

      await entries.list({ limit: 20, offset: 10 });

      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('limit=20');
      expect(callUrl).toContain('offset=10');
    });

    it('should skip null params', async () => {
      const { entries } = await import('./api.js');

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => []
      });

      await entries.list({ limit: 20, filter: null });

      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('limit=20');
      expect(callUrl).not.toContain('filter');
    });
  });

  describe('Request method', () => {
    it('should use POST for create', async () => {
      const { entries } = await import('./api.js');

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ slug: 'my-asset' })
      });

      await entries.create({ title: 'Test', assetData: 'abc' });

      expect(fetch.mock.calls[0][1].method).toBe('POST');
    });

    it('should use DELETE for delete and identify the entry via query params', async () => {
      const { entries } = await import('./api.js');

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'text/plain']]),
        text: async () => 'Deleted'
      });

      await entries.delete('alice', 'my-asset');

      const [url, options] = fetch.mock.calls[0];
      expect(options.method).toBe('DELETE');
      // Regression: the worker requires ?author=&slug= on DELETE
      expect(url).toContain('author=alice');
      expect(url).toContain('slug=my-asset');
    });

    it('should use PUT for update and identify the entry via query params', async () => {
      const { entries } = await import('./api.js');

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'text/plain']]),
        text: async () => 'Updated'
      });

      await entries.update('alice', 'my-asset', { description: 'Updated' });

      const [url, options] = fetch.mock.calls[0];
      expect(options.method).toBe('PUT');
      // Regression: the worker requires ?author=&slug= on PUT
      expect(url).toContain('author=alice');
      expect(url).toContain('slug=my-asset');
      expect(options.body).toBe(JSON.stringify({ description: 'Updated' }));
    });

    it('should send Content-Type header with JSON bodies even when logged out', async () => {
      const { entries } = await import('./api.js');

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ slug: 'x' })
      });

      await entries.create({ title: 'Test', assetData: 'abc' });

      const headers = fetch.mock.calls[0][1].headers;
      expect(headers['Content-Type']).toBe('application/json');
    });
  });
});
