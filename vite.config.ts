import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Vite dev server runs on http://localhost:5173 — treated as a secure context
// by browsers, which is required for the Notification + Service Worker APIs.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
});
