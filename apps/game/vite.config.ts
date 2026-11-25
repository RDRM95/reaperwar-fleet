import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  base: './',
  resolve: {
    alias: {
      '@rw/sim': here('../../packages/sim/src/index.ts'),
      '@rw/hulls': here('../../packages/hulls/src/index.ts'),
    },
  },
  worker: { format: 'es' },
  build: { outDir: here('../../dist'), emptyOutDir: true, target: 'es2022', sourcemap: true },
  server: { port: 5173, strictPort: true },
  define: { __BUILD__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev') },
});
