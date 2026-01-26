import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
  // Register immediately, don't wait for load event for better compatibility
  const registerSW = async () => {
    try {
      // For Vite builds, SW needs the full path from base
      const basePath = ((import.meta as any).env.BASE_URL || '/').replace(/\/$/, '');
      const swPath = basePath ? `${basePath}/sw.js` : '/sw.js';
      
      console.log('🔧 Registering Service Worker at:', swPath);
      console.log('📍 Base path:', basePath);
      
      // Service worker scope must end with trailing slash
      const swScope = basePath ? `${basePath}/` : '/';
      
      const registration = await navigator.serviceWorker.register(swPath, { 
        scope: swScope,
        updateViaCache: 'none' // Always check for updates
      });
      
      console.log('✅ ServiceWorker registration successful');
      console.log('📦 Scope:', registration.scope);
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🔄 New service worker available. Refresh to update.');
            }
          });
        }
      });
      
      // Check for existing service worker
      if (registration.active) {
        console.log('🔄 Active service worker found');
      }
      if (registration.installing) {
        console.log('⏳ Service worker installing...');
      }
      if (registration.waiting) {
        console.log('⌛ Service worker waiting...');
      }
      
    } catch (error) {
      console.error('❌ ServiceWorker registration failed:', error);
      const err = error as Error;
      console.error('Error details:', err.message);
      // Don't block app if SW fails - notifications will use direct API
      console.warn('⚠️ Continuing without Service Worker. Notifications will use direct API.');
    }
  };
  
  // Register on page load (better compatibility)
  if (document.readyState === 'loading') {
    window.addEventListener('load', registerSW);
  } else {
    // DOM already loaded
    registerSW();
  }
} else {
  console.warn('⚠️ Service Workers are not supported in this browser. Notifications will use direct API.');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);