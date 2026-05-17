import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign Vite HMR WebSocket errors that can occur in the preview environment
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && (
    event.reason.message === 'WebSocket closed without opened.' ||
    (typeof event.reason === 'string' && event.reason.includes('WebSocket'))
  )) {
    event.preventDefault();
    event.stopPropagation();
  }
});

window.addEventListener('error', (event) => {
  if (event.message && (
    event.message.includes('WebSocket') || 
    event.message.includes('vite')
  )) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
