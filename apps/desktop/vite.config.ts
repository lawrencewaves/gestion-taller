import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Tauri sirve los archivos desde su propio protocolo: rutas relativas.
export default defineConfig({
  base: './',
  plugins: [react()],
  clearScreen: false,
  server: { port: 5174, strictPort: true },
  // WKWebView de macOS 11 o posterior.
  build: { target: ['es2022', 'safari15'] },
});
