# API Client & Router Guide

## API Client (`public/api.js`)

The centralized API client provides a clean, consistent interface for all backend calls with automatic auth header injection and error handling.

### Basic Usage

```javascript
import { users, entries, slugs, APIError } from '/api.js';

// Get current user
const profile = await users.getMe();

// List all entries with filters
const results = await entries.list({ limit: 20, offset: 0 });

// Get a specific asset
const asset = await entries.get('username', 'slug');

// Create a new entry
const result = await entries.create({
  assetData: '...',
  title: 'My Asset',
  description: 'Optional',
  imageData: 'https://...'
});
```

### Error Handling

All API calls throw `APIError` on failure. Always wrap calls in try/catch:

```javascript
try {
  const data = await users.getMe();
} catch (err) {
  if (err instanceof APIError) {
    console.error(`API Error (${err.status}): ${err.message}`);
  } else {
    console.error('Network error:', err.message);
  }
}
```

### Available Endpoints

#### Users
- `users.getMe()` - Get current user profile
- `users.check(username)` - Check username availability
- `users.claim(username)` - Claim a username
- `users.delete()` - Delete current account
- `users.getProfile(username)` - Get user profile (public)

#### Entries
- `entries.list(options)` - List all entries (with pagination/filters)
- `entries.listMine()` - List current user's entries
- `entries.listByAuthor(author)` - List entries by author
- `entries.get(username, slug)` - Get specific entry
- `entries.create(data)` - Create new entry
- `entries.update(username, slug, data)` - Update entry
- `entries.delete(username, slug)` - Delete entry

#### Slugs
- `slugs.check(title)` - Check slug availability

### Migration from Raw Fetch

**Before:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const res = await fetch(`/api/slug/check?title=${encodeURIComponent(title)}`, {
  headers: { "Authorization": `Bearer ${session.access_token}` }
});
if (!res.ok) {
  console.error('Error:', await res.text());
  return;
}
const data = await res.json();
```

**After:**
```javascript
try {
  const data = await slugs.check(title);
} catch (err) {
  console.error('Error:', err.message);
}
```

---

## Enhanced Router (`public/router.js`)

The router now properly syncs URL state with page state, handles query parameters, and supports better back-button behavior.

### Query Parameters

Pages now receive both route parameters and query parameters as a single object:

```javascript
export async function init(params) {
  // params.username and params.slug come from the URL path
  // params.filter, params.sort come from ?filter=x&sort=y
  console.log(params);
}
```

### Building URLs

Use `buildUrl()` helper to create links with query params:

```javascript
import { buildUrl } from '/router.js';

// Create a URL with query params
const url = buildUrl('/my-assets', { filter: 'geonodes', sort: 'date' });
// Result: /my-assets?filter=geonodes&sort=date

// Use in navigation
window.spaNavigate(url);

// Or in HTML templates
const html = `<a href="${buildUrl('/search', { q: 'foo' })}">Search</a>`;
```

### State Preservation

The router now:
- Preserves query parameters through back/forward navigation
- Passes both route and query params to page `init()` functions
- Maintains URL as source of truth for page state

### Getting Current Route Info

```javascript
import { getCurrentRoute } from '/router.js';

const route = getCurrentRoute();
console.log(route.page); // 'asset'
console.log(route.params); // { username: 'alice', slug: 'foo-bar' }
```

### Best Practices

1. **Store important state in the URL** — Use query params for filters, sorts, page numbers
   ```javascript
   // Bad: state only in memory
   let page = 1;
   
   // Good: state in URL
   window.spaNavigate(buildUrl('/my-assets', { page: 1 }));
   ```

2. **Read params from `init()` not from global state**
   ```javascript
   export async function init(params) {
     const page = params.page || 1;
     // Load data for this page
   }
   ```

3. **Let the router handle navigation**
   ```javascript
   // Use spaNavigate for internal links
   window.spaNavigate('/my-assets');
   
   // Use normal <a href> in templates - router intercepts clicks
   `<a href="/asset/${username}/${slug}">View</a>`
   ```

---

## Migration Checklist

To update a page to use the new API client and router:

- [ ] Import from `/api.js` instead of making raw fetch calls
- [ ] Wrap API calls in try/catch for `APIError`
- [ ] Update `init(params)` to use `params` instead of `window.location`
- [ ] Use `buildUrl()` for links with query params
- [ ] Preserve important state in query params via URL
