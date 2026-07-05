import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['public/**/*.js'],
      exclude: ['public/**/*.test.js', 'public/pages/**']
    }
  }
});
