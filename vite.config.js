import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Source files are in /public, output goes to /dist
  root: 'public',
  
  // Static assets (images, etc.) that should be copied as-is to dist
  publicDir: '../static',

  plugins: [
    {
      name: 'auth-callback-rewrite',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (!req.url) return next();
          const [path, query] = req.url.split('?');
          if (path === '/auth/callback' || path === '/auth/callback/') {
            req.url = `/auth/callback/index.html${query ? `?${query}` : ''}`;
          } else if (path === '/auth/confirm' || path === '/auth/confirm/') {
            req.url = `/auth/confirm/index.html${query ? `?${query}` : ''}`;
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (!req.url) return next();
          const [path, query] = req.url.split('?');
          if (path === '/auth/callback' || path === '/auth/callback/') {
            req.url = `/auth/callback/index.html${query ? `?${query}` : ''}`;
          } else if (path === '/auth/confirm' || path === '/auth/confirm/') {
            req.url = `/auth/confirm/index.html${query ? `?${query}` : ''}`;
          }
          next();
        });
      },
    },
  ],
  
  build: {
    // Output to /dist (relative to project root, not /public)
    outDir: '../dist',
    emptyOutDir: true,
    
    // Keep source maps off by default in production.
    // Enable only when explicitly needed:
    // BUILD_SOURCEMAP=true npm run build
    sourcemap: process.env.BUILD_SOURCEMAP === 'true',
    
    // Rollup options for code splitting
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
        // Auth callback needs its own entry point
        'auth-callback': resolve(__dirname, 'public/auth/callback/index.html'),
        // Auth confirm page - handles email token verification client-side
        'auth-confirm': resolve(__dirname, 'public/auth/confirm/index.html'),
      },
    },
  },
  
  // Dev server settings
  server: {
    port: 3000,
    // Proxy API requests to wrangler dev server
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  
  // Resolve aliases (optional, but nice for cleaner imports)
  resolve: {
    alias: {
      '@': resolve(__dirname, 'public'),
    },
  },
});
