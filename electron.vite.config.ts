import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { randomBytes } from 'node:crypto';

export default defineConfig(({ command }) => {
  // Permit Vite's inline React refresh preamble without allowing arbitrary inline scripts.
  const nonce = randomBytes(16).toString('base64');
  return {
  main: {
    build: {
      outDir: 'dist/main',
      lib: { entry: resolve('electron/main.ts') },
    },
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      lib: { entry: resolve('electron/preload.ts'), formats: ['cjs'], fileName: () => 'preload.cjs' },
    },
  },
  renderer: {
    root: '.',
    base: './',
    publicDir: 'public',
    html: { cspNonce: command === 'serve' ? nonce : undefined },
    plugins: [react(), {
      name: 'bdc-development-csp',
      transformIndexHtml(html) {
        return command === 'serve' ? html.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`) : html;
      },
    }],
    server: { host: '127.0.0.1' },
    build: {
      outDir: 'dist/renderer',
      rollupOptions: { input: resolve('index.html') },
    },
  },
  };
});
