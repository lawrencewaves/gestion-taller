/** Composición del navegador (DEMO, PREVIEW, LOCAL): la interfaz habla con el Worker por mensajes. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { connect } from '@gonzalvo/adapter-worker-rpc';
import type { Capabilities, Services } from '@gonzalvo/contracts';
import { App } from '@gonzalvo/ui';
import { appInfo } from './env';

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'gonzalvo-datos' });
const services = connect<Services>(worker);

const capabilities: Capabilities = { backups: false, directPrint: false, demoReset: true };

const root = document.getElementById('root');
if (!root) throw new Error('Falta el elemento #root en index.html');

createRoot(root).render(
  <StrictMode>
    <App services={services} info={appInfo} capabilities={capabilities} />
  </StrictMode>,
);
