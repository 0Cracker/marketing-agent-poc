import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath,URL} from 'node:url';
import {currentDataPlugin} from './scripts/current-data.mjs';
export default defineConfig({
  root: fileURLToPath(new URL('./frontend', import.meta.url)),
  publicDir: false,
  plugins: [react(),currentDataPlugin()],
  resolve: {alias: {'@': fileURLToPath(new URL('./frontend', import.meta.url))}},
  build: {outDir: '../dist', emptyOutDir: true},
});
