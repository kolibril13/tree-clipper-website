// SPA Router - handles client-side navigation
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
  // Dynamic routes handled by pattern matching
];

// Page modules - lazy loaded
const pageModules = {};

// Current page cleanup function
let currentCleanup = null;

// Get the content container
function getContentContainer() {
  return document.getElementById('spa-content');
}

// Match a path to a route
function matchRoute(path) {
  // Normalize path
  const normalizedPath = path === '' ? '/' : path;
  
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
  
  // Run cleanup for current page
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (e) {
      console.error('Page cleanup error:', e);
    }
    currentCleanup = null;
  }
  
  // Match route
  const { page, params } = matchRoute(path);
  
  // Update URL
  if (pushState) {
    history.pushState({ path }, '', path);
  }
  
  // Load and render page
  try {
    const pageModule = await loadPage(page);
    
    // Get page HTML template
    const html = pageModule.template ? pageModule.template(params) : '';
    container.innerHTML = html;
    
    // Initialize page (returns cleanup function if any)
    if (pageModule.init) {
      currentCleanup = await pageModule.init(params) || null;
    }
    
    // Update document title
    if (pageModule.title) {
      document.title = typeof pageModule.title === 'function' 
        ? pageModule.title(params) 
        : pageModule.title;
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
    
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
  const path = event.state?.path || window.location.pathname;
  navigate(path, false);
}

// Initialize router
export function initRouter() {
  // Listen for clicks on the document
  document.addEventListener('click', handleClick);
  
  // Listen for hover to prefetch asset data
  document.addEventListener('mouseover', handleMouseOver, { passive: true });
  
  // Listen for browser navigation
  window.addEventListener('popstate', handlePopState);
  
  // Initial navigation
  navigate(window.location.pathname, false);
}

// Expose navigate globally for onclick handlers etc.
window.spaNavigate = navigate;
