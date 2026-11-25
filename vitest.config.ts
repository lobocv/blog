import { defineConfig } from 'vitest/config';

// Projects are described in docs/editor/architecture.md ("Testing").
export default defineConfig({
  test: {
    env: { TZ: 'America/Los_Angeles' },
    projects: [
      { extends: true, test: { name: 'blog', include: ['src/**/*.test.ts'] } },
      {
        extends: true,
        test: {
          name: 'editor-node',
          include: ['editor/**/*.test.ts', 'shared/**/*.test.ts'],
          exclude: ['editor/ui/**'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'editor-dom',
          include: ['editor/ui/**/*.test.{ts,tsx}'],
          environment: 'happy-dom',
        },
      },
    ],
  },
});
