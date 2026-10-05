import { defineConfig } from 'vitest/config';

// Tests use global describe/it/expect only, so they also run under Jest:
// the SharePoint Framework build ("npm run build") runs them again that way.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'preview/checks/*.test.ts']
  }
});
