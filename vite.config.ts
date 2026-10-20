import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath,URL} from 'node:url';
import {currentDataPlugin} from './scripts/current-data.mjs';
const agentPort=Number(process.env.AGENT_API_PORT||8788);
if(!Number.isInteger(agentPort)||agentPort<1024||agentPort>65535)throw Error('Invalid AGENT_API_PORT');
export default defineConfig({
  root: fileURLToPath(new URL('./frontend', import.meta.url)),
  publicDir: false,
  plugins: [react(),currentDataPlugin()],
  resolve: {alias: {'@': fileURLToPath(new URL('./frontend', import.meta.url))}},
  server: {proxy: {'/agent-api': {target:`http://127.0.0.1:${agentPort}`,changeOrigin:true}}},
  build: {outDir: '../dist', emptyOutDir: true},
});
