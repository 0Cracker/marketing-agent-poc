import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath,URL} from 'node:url';
import {currentDataPlugin} from './legacy/scripts/current-data.mjs';
import {reviewDataPlugin} from './legacy/scripts/review-data.mjs';

export default defineConfig({
  root:fileURLToPath(new URL('./legacy/frontend',import.meta.url)),
  publicDir:false,
  plugins:[react(),reviewDataPlugin(),currentDataPlugin()],
  resolve:{alias:{'@':fileURLToPath(new URL('./legacy/frontend',import.meta.url))}},
  server:{host:'127.0.0.1',port:5174},
  build:{outDir:'../../work/legacy-dist',emptyOutDir:true},
});
