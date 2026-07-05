# Testing Guide

This project uses Vitest for unit testing and provides examples for end-to-end testing.

## Running Tests

### Unit Tests
```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm test -- --watch

# Run specific test file
npm test api.test.js

# Run with UI dashboard
npm test:ui

# Generate coverage report
npm test:coverage
```

## Test Structure

### Existing Test Suites

- **`public/api.test.js`** — Tests for API client
  - Error handling (APIError)
  - Request/response handling (JSON, text, errors)
  - Endpoint grouping (users, entries, slugs)
  - Query parameters
  - HTTP methods (GET, POST, PUT, DELETE)

- **`public/router.test.js`** — Tests for router
  - URL parsing and query parameters
  - buildUrl() helper function
  - Route matching patterns
  - getCurrentRoute() function
  - Global exposure (spaNavigate, spaUrl)

- **`public/logger.test.js`** — Tests for error logger
  - LogEntry creation
  - Logging functions (info, warn, error)
  - Exception handling
  - Error storage and limits
  - Error export (JSON)
  - Console integration

## Writing Tests

### Basic Test Structure

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Component Name', () => {
  beforeEach(() => {
    // Reset state before each test
    vi.clearAllMocks();
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = process.input(input);

    // Assert
    expect(result).toBe('expected');
  });

  it('should handle error cases', async () => {
    await expect(async_function()).rejects.toThrow('Error message');
  });
});
```

### Common Testing Patterns

**Testing async functions:**
```javascript
it('should fetch data', async () => {
  const data = await fetchUserProfile('alice');
  expect(data.username).toBe('alice');
});
```

**Mocking fetch:**
```javascript
import { vi } from 'vitest';

beforeEach(() => {
  global.fetch = vi.fn();
});

it('should handle API response', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: '123' })
  });

  const result = await api.call();
  expect(result.id).toBe('123');
});
```

**Spying on console:**
```javascript
it('should log error', () => {
  const spy = vi.spyOn(console, 'error');
  throwError();
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});
```

## End-to-End Testing

For testing critical user flows (upload → view → share), we recommend Playwright or Cypress. Here's a setup guide:

### Install Playwright

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### Example E2E Test

Create `e2e/upload-flow.test.js`:

```javascript
import { test, expect } from '@playwright/test';

test.describe('Upload & Share Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    // Login if needed
  });

  test('should upload asset and view it', async ({ page }) => {
    // 1. Navigate to upload page
    await page.click('a:has-text("Upload")');
    expect(page.url()).toContain('/upload-asset');

    // 2. Fill form
    await page.fill('#asset-data', 'TreeClipper::...');
    await page.fill('#title', 'My Geometry Node');
    await page.fill('#description', 'A test node setup');

    // 3. Submit
    await page.click('button:has-text("Submit")');

    // 4. Wait for redirect
    await page.waitForNavigation();
    expect(page.url()).toMatch(/\/\w+\/[\w-]+$/);

    // 5. Verify content is displayed
    await expect(page.locator('h1')).toContainText('My Geometry Node');
    await expect(page.locator('.asset-description')).toContainText('A test node setup');

    // 6. Test copy button
    await page.click('.asset-copy-btn');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('TreeClipper::');
  });

  test('should delete asset', async ({ page }) => {
    // Navigate to my-assets
    await page.click('a:has-text("My Assets")');

    // Click delete on first asset
    await page.click('.asset-delete-btn');

    // Confirm deletion
    await page.click('button:has-text("Delete")');

    // Asset should be gone
    await expect(page.locator('.my-assets-list')).not.toContainText('My Geometry Node');
  });
});
```

### Run E2E Tests

```bash
# Start dev server in one terminal
npm run dev

# In another terminal, run tests
npx playwright test

# Or with UI
npx playwright test --ui
```

## Critical Flow Tests

Key flows to test:

1. **Upload Flow**
   - User logs in
   - Fills upload form with node data
   - Uploads image
   - Submits
   - Redirected to asset page
   - Asset displays correctly
   - Share URL works

2. **Browse & Discover**
   - Homepage loads assets
   - Filtering by node type works
   - Search functionality works
   - Pagination works
   - Clicking asset loads detail page

3. **Edit & Update**
   - User views their asset
   - Clicks edit
   - Updates fields
   - Saves changes
   - Changes persist on reload

4. **User Profile**
   - Navigate to user profile
   - See user's assets
   - Load asset from profile
   - Share profile URL

5. **Authentication**
   - Login with Discord
   - Login with email/magic link
   - Logout clears session
   - Protected pages redirect to login

## Coverage Goals

- **API client**: 80%+ (critical for stability)
- **Router**: 70%+ (good coverage of route patterns)
- **Logger**: 85%+ (should be comprehensive)
- **Pages**: 40%+ (e2e tests preferred over unit)

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## Debugging Tests

### Run single test
```bash
npm test api.test.js -t "should handle successful JSON response"
```

### Enable debug logging
```bash
DEBUG=* npm test
```

### Interactive debugging
```bash
node --inspect-brk ./node_modules/vitest/vitest.mjs
# Then open chrome://inspect
```

## Best Practices

1. **Test behavior, not implementation**
   ```javascript
   // Good - tests what the function does
   expect(result.username).toBe('alice');

   // Bad - tests internals
   expect(apiCall.mock.calls[0][0]).toContain('users');
   ```

2. **Use descriptive test names**
   ```javascript
   // Good
   it('should throw APIError with 404 status when user not found');

   // Bad
   it('should throw error');
   ```

3. **Keep tests focused and small**
   ```javascript
   // Good - one assertion concept per test
   it('should include timestamp in log entry', () => {
     const entry = new LogEntry('info', 'Test');
     expect(entry.timestamp).toBeDefined();
   });

   // Bad - too many concepts
   it('should work correctly', () => {
     const entry = new LogEntry(...);
     expect(entry.timestamp).toBeDefined();
     expect(entry.message).toBe('Test');
     expect(entry.level).toBe('info');
     // ... many more assertions
   });
   ```

4. **Mock external dependencies**
   ```javascript
   // Always mock fetch, localStorage, etc.
   global.fetch = vi.fn();
   ```

5. **Use setup/teardown properly**
   ```javascript
   beforeEach(() => {
     // Reset before each test
     vi.clearAllMocks();
   });

   afterEach(() => {
     // Clean up after each test
     vi.restoreAllMocks();
   });
   ```
