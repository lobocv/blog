import { defineConfig } from '@playwright/test';

// The editor's end-to-end test (`make verify-editor`). See docs/editor/architecture.md.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
});
