# Error Logging Guide

The app has a simple client-side error logging system that captures errors and makes them accessible for debugging and reporting.

## Overview

- **Automatic capture**: Uncaught exceptions, unhandled promise rejections, and API errors are automatically logged
- **In-memory store**: Keeps the last 50 errors to prevent memory leaks
- **Debugging**: Access logs via browser console
- **Reporting**: Can send errors to backend endpoint (requires `/api/errors` endpoint)

## Manual Logging

Import and use the logger in your pages:

```javascript
import { error, warn, info, exception } from '/logger.js';

// Log an info message
info('User uploaded asset', { assetId: '123', size: 5000 });

// Log a warning
warn('Slow API response', { endpoint: '/api/entries', duration: 3000 });

// Log an error
error('Failed to save draft', { reason: 'Network timeout' });

// Log an exception
try {
  JSON.parse('{invalid}');
} catch (err) {
  exception(err);
}
```

## Automatic Error Capture

All errors are automatically captured:

```javascript
// Uncaught errors
throw new Error('Something broke');

// Unhandled promise rejections
Promise.reject(new Error('Async failed'));

// API errors (automatically logged by api.js)
const data = await entries.list(); // If it fails, error is logged
```

## Accessing Logs

In the browser console:

```javascript
// View all logged errors
window.logger = await import('/logger.js');
const errors = window.logger.getErrors();
console.table(errors);

// Get formatted JSON
console.log(window.logger.getErrorsJson());

// Clear errors
window.logger.clearErrors();
```

## Sending Errors to Backend

To send errors to your backend (requires `/api/errors` POST endpoint):

```javascript
import { reportErrors } from '/logger.js';

// Send last 10 errors to backend
await reportErrors();

// Or to a custom endpoint
await reportErrors('/custom/error-endpoint');
```

Errors are automatically sent on page unload if available.

## Backend Integration (Optional)

To capture errors on your backend, create an API endpoint:

```
POST /api/errors
{
  "errors": [
    {
      "level": "error",
      "message": "API Error: GET /api/entries (404)",
      "data": { "endpoint": "/api/entries", ... },
      "timestamp": "2026-07-05T12:34:56.789Z",
      "url": "/my-assets",
      "userAgent": "Mozilla/5.0..."
    }
  ]
}
```

## Log Entry Structure

Each log entry contains:

```javascript
{
  level: 'error' | 'warn' | 'info',
  message: string,
  data: object,              // Optional context data
  timestamp: ISO8601,        // When the error occurred
  url: string,               // Page path + query string
  userAgent: string          // Browser info
}
```

## Best Practices

1. **Log API errors with context**:
   ```javascript
   // Good - includes what was being done
   error('Failed to upload asset', {
     assetId: '123',
     attempt: 2,
     error: 'Network timeout'
   });
   ```

2. **Don't log sensitive data**:
   ```javascript
   // Bad - includes auth tokens
   error('Auth failed', { token: session.access_token });
   
   // Good - only relevant info
   error('Auth failed', { reason: 'Invalid credentials' });
   ```

3. **Use appropriate levels**:
   ```javascript
   info('User action', { action: 'created asset' });    // Informational
   warn('Non-critical issue', { degraded: true });      // Warning
   error('Operation failed', { reason: 'Server error' }); // Error
   ```

4. **Include enough context for debugging**:
   ```javascript
   // Bad - vague
   error('Failed');
   
   // Good - actionable
   error('Failed to delete asset', {
     author: 'alice',
     slug: 'my-asset',
     attemptedAt: new Date().toISOString()
   });
   ```

## Limits

- **Max errors stored**: 50 (oldest are removed)
- **Errors sent per report**: 10 (last 10 errors)
- **Error size**: Unbounded (be careful with large data objects)
