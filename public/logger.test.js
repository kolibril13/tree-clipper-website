import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LogEntry,
  info,
  warn,
  error,
  exception,
  getErrors,
  clearErrors,
  getErrorsJson
} from './logger.js';

describe('Logger', () => {
  beforeEach(() => {
    clearErrors();
    vi.clearAllMocks();
  });

  describe('LogEntry', () => {
    it('should create log entry with all fields', () => {
      const entry = new LogEntry('error', 'Test message', { key: 'value' });

      expect(entry.level).toBe('error');
      expect(entry.message).toBe('Test message');
      expect(entry.data).toEqual({ key: 'value' });
      expect(entry.timestamp).toBeDefined();
      expect(entry.url).toBeDefined();
      expect(entry.userAgent).toBeDefined();
    });

    it('should use current timestamp', () => {
      const before = new Date();
      const entry = new LogEntry('info', 'Test');
      const after = new Date();

      const entryTime = new Date(entry.timestamp);
      expect(entryTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entryTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should include current URL', () => {
      const entry = new LogEntry('info', 'Test');
      expect(entry.url).toBeDefined();
      expect(typeof entry.url).toBe('string');
    });
  });

  describe('Logging functions', () => {
    it('info should create info-level entry', () => {
      info('Info message', { data: 'value' });

      const errors = getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].level).toBe('info');
      expect(errors[0].message).toBe('Info message');
    });

    it('warn should create warn-level entry', () => {
      warn('Warning message', { issue: 'slow' });

      const errors = getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].level).toBe('warn');
      expect(errors[0].message).toBe('Warning message');
    });

    it('error should create error-level entry', () => {
      error('Error message', { reason: 'failed' });

      const errors = getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].level).toBe('error');
      expect(errors[0].message).toBe('Error message');
    });

    it('exception should log error with stack', () => {
      const err = new Error('Test error');
      err.stack = 'at test:1:2';

      exception(err);

      const errors = getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].level).toBe('error');
      expect(errors[0].data.message).toBe('Test error');
      expect(errors[0].data.stack).toBe('at test:1:2');
    });

    it('exception should handle non-Error objects', () => {
      exception('String error');

      const errors = getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].data.message).toBe('String error');
    });
  });

  describe('Error storage', () => {
    it('should store multiple errors', () => {
      error('Error 1');
      error('Error 2');
      error('Error 3');

      const errors = getErrors();
      expect(errors.length).toBe(3);
    });

    it('should limit stored errors to MAX_ERRORS', () => {
      // Add 60 errors (MAX_ERRORS is 50)
      for (let i = 0; i < 60; i++) {
        error(`Error ${i}`);
      }

      const errors = getErrors();
      expect(errors.length).toBe(50);
      // Oldest errors should be gone
      expect(errors[0].message).toBe('Error 10');
      expect(errors[49].message).toBe('Error 59');
    });

    it('clearErrors should empty the store', () => {
      error('Error 1');
      error('Error 2');

      expect(getErrors().length).toBe(2);

      clearErrors();
      expect(getErrors().length).toBe(0);
    });
  });

  describe('Error export', () => {
    it('getErrors should return array copy', () => {
      error('Error 1');
      error('Error 2');

      const errors = getErrors();
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBe(2);
    });

    it('getErrorsJson should return JSON string', () => {
      error('Error 1', { code: 500 });

      const json = getErrorsJson();
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].message).toBe('Error 1');
      expect(parsed[0].data.code).toBe(500);
    });

    it('getErrorsJson should be valid JSON', () => {
      error('Error 1');
      error('Error 2');

      const json = getErrorsJson();
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('Data preservation', () => {
    it('should preserve structured data', () => {
      const data = {
        userId: '123',
        endpoint: '/api/users',
        status: 404,
        nested: { field: 'value' }
      };

      error('API error', data);

      const errors = getErrors();
      expect(errors[0].data).toEqual(data);
    });

    it('should handle null data', () => {
      error('Error without data');

      const errors = getErrors();
      expect(errors[0].data).toEqual({});
    });

    it('should handle large data objects', () => {
      const largeData = {};
      for (let i = 0; i < 1000; i++) {
        largeData[`field${i}`] = `value${i}`;
      }

      error('Error with large data', largeData);

      const errors = getErrors();
      expect(Object.keys(errors[0].data).length).toBe(1000);
    });
  });

  describe('Console logging', () => {
    it('should call console.log for info', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      info('Info message');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should call console.warn for warn', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      warn('Warning message');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should call console.error for error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      error('Error message');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
