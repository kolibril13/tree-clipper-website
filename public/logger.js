// Simple client-side error logging and reporting
// Captures uncaught errors, API errors, and custom messages
// Stores errors in memory with a size limit to prevent memory leaks

const MAX_ERRORS = 50; // Keep last 50 errors
const errors = [];

export class LogEntry {
  constructor(level, message, data = {}) {
    this.level = level; // 'info', 'warn', 'error'
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
    this.url = window.location.pathname + window.location.search;
    this.userAgent = navigator.userAgent;
  }
}

// Add error to store
function addError(entry) {
  errors.push(entry);
  // Keep size bounded
  if (errors.length > MAX_ERRORS) {
    errors.shift();
  }
}

// Core logging functions
export function info(message, data) {
  const entry = new LogEntry('info', message, data);
  console.log(`[${entry.timestamp}] ${message}`, data);
  addError(entry);
}

export function warn(message, data) {
  const entry = new LogEntry('warn', message, data);
  console.warn(`[${entry.timestamp}] ${message}`, data);
  addError(entry);
}

export function error(message, data) {
  const entry = new LogEntry('error', message, data);
  console.error(`[${entry.timestamp}] ${message}`, data);
  addError(entry);
}

// Log an exception with stack trace
export function exception(err) {
  const data = {
    message: err?.message || String(err),
    stack: err?.stack || 'No stack trace',
    name: err?.name || 'Error'
  };
  error(`${data.name}: ${data.message}`, data);
}

// Get all logged errors
export function getErrors() {
  return [...errors];
}

// Clear error log
export function clearErrors() {
  errors.length = 0;
}

// Get errors as JSON for sending to server
export function getErrorsJson() {
  return JSON.stringify(errors, null, 2);
}

// Send errors to a backend endpoint
export async function reportErrors(endpoint = '/api/errors') {
  if (errors.length === 0) return;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errors: errors.slice(-10) }) // Send last 10
    });

    if (response.ok) {
      clearErrors();
      return true;
    }
  } catch (err) {
    // Silently fail - don't create infinite loop of error reporting
    console.error('Failed to report errors:', err);
  }

  return false;
}

// Initialize global error handlers
export function initErrorHandlers() {
  // Catch uncaught errors
  window.addEventListener('error', (event) => {
    exception(event.error || new Error(event.message));
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    exception(event.reason);
  });
}

// Send errors on page unload (best effort)
export function initExitHandler() {
  window.addEventListener('beforeunload', () => {
    // Use sendBeacon for reliability on unload
    if (navigator.sendBeacon && errors.length > 0) {
      navigator.sendBeacon('/api/errors', JSON.stringify({ errors: errors.slice(-5) }));
    }
  });
}
