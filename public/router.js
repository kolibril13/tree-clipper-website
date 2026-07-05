// SPA Router - handles client-side navigation with URL/state syncing
// The login corner is rendered once and persists across page navigations

// Route definitions - supports both with and without .html extension
const routes = [
  { path: '/', page: 'home' },
  { path: '/index.html', page: 'home' },
  { path: '/login', page: 'login' },
  { path: '/login.html', page: 'login' },
  { path: '/my-assets', page: 'my-assets' },
  { path: '/my-assets.html', page: 'my-assets' },
  { path: '/upload-asset', page: 'upload' },
  { path: '/upload-asset.html', page: 'upload' },
  { path: '/settings', page: 'settings' },
  { path: '/settings.html', page: 'settings' },
  { path: '/claim-username', page: 'claim-username' },
  { path: '/claim-username.html', page: 'claim-username' },
  { path: '/terms', page: 'terms' },
  { path: '/terms.html', page: 'terms' },
  { path: '/imprint', page: 'imprint' },
  { path: '/imprint.html', page: 'imprint' },
  { path: '/getting-started', page: 'getting-started' },
  { path: '/getting-started.html', page: 'getting-started' },
  // Dynamic routes handled by pattern matching
];

// Page modules - lazy loaded
const pageModules = {};

// Current page state
let currentCleanup = null;
let currentRoute = null;

// Parse URL into path and query params
function parseUrl(url) {
  const urlObj = new URL(url, window.location.origin);
  return {
    pathname: urlObj.pathname,
    search: urlObj.search,
    hash: urlObj.hash,
    params: Object.fromEntries(urlObj.searchParams)
  };
}

// Get the content container
function getContentContainer() {
  return document.getElementById('spa-content');
}

// Match a path to a route
function matchRoute(path) {
  // Normalize path
  const normalizedPath = path === '' ? '/' : path;
  
  // Skip auth callback - let it handle itself (full page load)
  if (normalizedPath.startsWith('/auth/')) {
    return { page: null, params: {} };
  }
  
  // Check static routes first
  for (const route of routes) {
    if (route.path === normalizedPath) {
      return { page: route.page, params: {} };
    }
  }
  
  // Check for dynamic routes: /:username/:slug (asset page)
  const parts = normalizedPath.split('/').filter(Boolean);
  
  if (parts.length === 2 && !parts[1].includes('.')) {
    return { 
      page: 'asset', 
      params: { 
        username: decodeURIComponent(parts[0]), 
        slug: decodeURIComponent(parts[1]) 
      } 
    };
  }
  
  // Check for /:username (user profile)
  if (parts.length === 1 && !parts[0].includes('.')) {
    return { 
      page: 'user', 
      params: { 
        username: decodeURIComponent(parts[0]) 
      } 
    };
  }
  
  // Not found
  return { page: '404', params: {} };
}

// Load a page module
async function loadPage(pageName) {
  if (!pageModules[pageName]) {
    try {
      // Use relative path for Vite's dynamic import analysis
      pageModules[pageName] = await import(`./pages/${pageName}.js`);
    } catch (err) {
      console.error(`Failed to load page module: ${pageName}`, err);
      pageModules[pageName] = await import('./pages/404.js');
    }
  }
  return pageModules[pageName];
}

// Navigate to a path
export async function navigate(path, pushState = true) {
  const container = getContentContainer();
  if (!container) {
    console.error('SPA content container not found');
    return;
  }

  // Parse URL to extract pathname and query params
  const parsed = parseUrl(path);
  const pathname = parsed.pathname;

  // Match route
  const { page, params: routeParams } = matchRoute(pathname);

  // If page is null, do a full page navigation (e.g., auth callback)
  if (page === null) {
    window.location.href = pathname;
    return;
  }

  // Run cleanup for current page
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (e) {
      console.error('Page cleanup error:', e);
    }
    currentCleanup = null;
  }

  // Merge route params with query params
  const allParams = { ...routeParams, ...parsed.params };

  // Update URL
  if (pushState) {
    history.pushState({ path: pathname, params: parsed.params }, '', path);
  }

  // Load and render page
  try {
    const pageModule = await loadPage(page);

    // Get page HTML template
    const html = pageModule.template ? pageModule.template(allParams) : '';
    container.innerHTML = html;

    // Initialize page with all params (route + query)
    if (pageModule.init) {
      currentCleanup = await pageModule.init(allParams) || null;
    }

    // Update document title
    if (pageModule.title) {
      document.title = typeof pageModule.title === 'function'
        ? pageModule.title(allParams)
        : pageModule.title;
    }

    // Scroll to top
    window.scrollTo(0, 0);

    // Store current route for debugging/inspection
    currentRoute = { page, params: allParams };

  } catch (err) {
    console.error('Page load error:', err);
    container.innerHTML = '<h1>Error</h1><p>Failed to load page.</p>';
  }
}

// Handle link clicks - intercept internal navigation
function handleClick(event) {
  // Find the closest anchor tag
  const anchor = event.target.closest('a');
  if (!anchor) return;

  const href = anchor.getAttribute('href');
  if (!href) return;

  // Skip external links
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
    return;
  }

  // Skip links with target="_blank"
  if (anchor.target === '_blank') return;

  // Skip download links
  if (anchor.hasAttribute('download')) return;

  // Skip hash-only links
  if (href.startsWith('#')) return;

  // Prevent default and navigate
  event.preventDefault();

  // Convert relative URLs to absolute paths
  let path = href;
  if (!path.startsWith('/')) {
    const currentPath = window.location.pathname;
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
    path = `${basePath}/${href}`.replace(/\/+/g, '/');
  }

  navigate(path);
}

// Prefetch asset data on hover for faster navigation
function handleMouseOver(event) {
  const anchor = event.target.closest('a');
  if (!anchor) return;
  
  const href = anchor.getAttribute('href');
  if (!href || !href.startsWith('/')) return;
  
  // Check if this is an asset link (/:username/:slug pattern)
  const match = matchRoute(href);
  if (match.page === 'asset' && match.params.username && match.params.slug) {
    // Dynamically import and prefetch
    import('./pages/asset.js').then(module => {
      if (module.prefetch) {
        module.prefetch(match.params.username, match.params.slug);
      }
    }).catch(() => {}); // Ignore errors
  }
}

// Handle browser back/forward
function handlePopState(event) {
  // Reconstruct full path from state and current URL
  const path = event.state?.path || window.location.pathname;
  const search = window.location.search;
  const fullPath = path + search;
  navigate(fullPath, false);
}

// Helper: Build a URL with query params for navigation
export function buildUrl(pathname, params = {}) {
  const url = new URL(pathname, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, v);
  });
  return url.pathname + url.search;
}

// Helper: Get current route info
export function getCurrentRoute() {
  return currentRoute;
}

// Initialize router
export function initRouter() {
  // Listen for clicks on the document
  document.addEventListener('click', handleClick);

  // Listen for hover to prefetch asset data
  document.addEventListener('mouseover', handleMouseOver, { passive: true });

  // Listen for browser navigation
  window.addEventListener('popstate', handlePopState);

  // Initial navigation with full URL (path + query)
  const fullPath = window.location.pathname + window.location.search;
  navigate(fullPath, false);
}

// Expose navigate and URL builder globally for onclick handlers etc.
window.spaNavigate = navigate;
window.spaUrl = buildUrl;
