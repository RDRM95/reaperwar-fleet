import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@rw/sim': fileURLToPath(new URL('./packages/sim/src/index.ts', import.meta.url)),
      '@rw/hulls': fileURLToPath(new URL('./packages/hulls/src/index.ts', import.meta.url)),
    },
  },
  test: { include: ['packages/**/*.test.ts', 'tests/unit/**/*.test.ts'] },
});
