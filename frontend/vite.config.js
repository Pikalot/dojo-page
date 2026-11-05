import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// With VITE_USE_API=true the browser calls /api on this same origin, and Vite
// passes it on to Django. Production needs the same routing in its web server.
const proxy = { '/api': 'http://127.0.0.1:8000' };

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
});
