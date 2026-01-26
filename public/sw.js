// Cache version with timestamp for automatic invalidation
const CACHE_VERSION = 'tm-booker-v6';
const CACHE_NAME = `${CACHE_VERSION}-${Date.now()}`;
const BASE_PATH = '/copy-of-toastmaster-slot-booker';

// Check if we're in development mode (localhost or 127.0.0.1)
const isDevelopment = self.location.hostname === 'localhost' || 
                      self.location.hostname === '127.0.0.1' ||
                      self.location.hostname.includes('localhost');

// Assets to cache - using relative paths for GitHub Pages
const urlsToCache = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/logo.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install SW and cache static assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...', CACHE_NAME);
  
  // In development, skip waiting immediately for faster updates
  // In production, wait for activation
  if (isDevelopment) {
    self.skipWaiting();
  }
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching assets:', urlsToCache);
        // Don't fail if some URLs fail to cache (external CDNs might block)
        return Promise.all(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.warn(`⚠️ Failed to cache ${url}:`, err);
            })
          )
        );
      })
      .then(() => {
        // Skip waiting after cache is populated (faster updates)
        if (!isDevelopment) {
          self.skipWaiting();
        }
      })
      .catch(err => {
        console.error('❌ Cache open failed:', err);
        // Still skip waiting even if cache fails
        self.skipWaiting();
      })
  );
});

// Activate SW and remove old caches
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activating...', CACHE_NAME);
  event.waitUntil(
    Promise.all([
      // Delete ALL old caches (including old versions)
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete if it's an old version or not the current cache
            if (cacheName.startsWith('tm-booker-') && cacheName !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients immediately (take control of all pages)
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated and ready');
      // Notify all clients that SW is ready
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_ACTIVATED', cacheName: CACHE_NAME });
        });
      });
    })
  );
});

// 1. CLICK LISTENER: Focuses the app window when user clicks the notification
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification.title);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(BASE_PATH) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(BASE_PATH + '/');
      }
    })
  );
});

// Handle notification close (for future features)
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.title);
});

// Intercept requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // CRITICAL FOR SUPABASE:
  // Don't cache API calls - we want fresh data every time
  if (url.hostname.includes('supabase.co') || request.method !== 'GET') {
    return; // Let browser handle normally
  }

  // Skip caching for non-origin requests (external resources)
  if (!url.pathname.includes(BASE_PATH) && url.origin !== self.location.origin) {
    // For external CDN resources, try network first, fall back to cache
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
    );
    return;
  }

  // For app assets: Network First strategy (better for development/testing)
  // In development, always fetch fresh. In production, try network first, fallback to cache
  if (isDevelopment) {
    // Development: Network only, don't cache aggressively
    event.respondWith(
      fetch(request).catch(() => {
        // Only use cache if network completely fails
        return caches.match(request);
      })
    );
  } else {
    // Production: Network First, then Cache
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Check if we received a valid response
          if (response && response.status === 200 && response.type !== 'error') {
            // Clone the response for caching
            const responseToCache = response.clone();
            
            // Cache successful responses in background (don't block)
            caches.open(CACHE_NAME).then((cache) => {
              // Only cache app assets, not external resources
              if (url.pathname.includes(BASE_PATH) || url.hostname === 'cdn.tailwindcss.com') {
                cache.put(request, responseToCache).catch(err => {
                  console.warn('Cache put failed:', err);
                });
              }
            });
            
            return response;
          }
          // If network response is invalid, try cache
          return caches.match(request);
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request);
        })
    );
  }
});
