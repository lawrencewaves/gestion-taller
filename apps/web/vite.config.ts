import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// BASE_PATH lo fija la publicación: /gestion-taller/ (DEMO) o /gestion-taller/preview/<rama>/ (PREVIEW).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  worker: { format: 'es' },
  // SQLite WASM carga su propio .wasm y no admite el preempaquetado de Vite.
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  build: { target: 'es2022' },
});
