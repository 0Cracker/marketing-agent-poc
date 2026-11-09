import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

const frontend=fileURLToPath(new URL('./frontend/',import.meta.url));

export default defineConfig({
  root:frontend,
  publicDir:false,
  plugins:[react()],
  build:{
    outDir:'../.agent-state/trace-ui',
    emptyOutDir:true,
    rollupOptions:{input:frontend+'agent-trace-chat.html'},
  },
});
