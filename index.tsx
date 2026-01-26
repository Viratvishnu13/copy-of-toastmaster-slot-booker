import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // For Vite builds, SW needs the full path from base
    const basePath = ((import.meta as any).env.BASE_URL || '/').replace(/\/$/, '');
    const swPath = basePath ? `${basePath}/sw.js` : '/sw.js';
    
    console.log('🔧 Registering Service Worker at:', swPath);
    console.log('📍 Base path:', basePath);
    
    navigator.serviceWorker.register(swPath, { scope: basePath || '/' })
      .then((registration) => {
        console.log('✅ ServiceWorker registration successful');
        console.log('📦 Scope:', registration.scope);
        console.log('🔄 Active:', registration.active);
        console.log('⏳ Installing:', registration.installing);
        console.log('⌛ Waiting:', registration.waiting);
      })
      .catch((error) => {
        console.error('❌ ServiceWorker registration failed:', error);
        console.error('Error details:', error.message);
      });
  });
} else {
  console.warn('⚠️ Service Workers are not supported in this browser');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);