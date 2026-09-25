import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Serve the production CSP from netlify.toml during `vite preview`, so the smoke test runs under the real policy
function netlifyCsp() {
  try {
    const toml = readFileSync(new URL('./netlify.toml', import.meta.url), 'utf8');
    return toml.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1];
  } catch {
    return undefined;
  }
}

const csp = netlifyCsp();

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, open: true },
  preview: { headers: csp ? { 'Content-Security-Policy': csp } : {} },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.js']
  }
});
