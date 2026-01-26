const CACHE_NAME = 'tm-booker-v5';
const BASE_PATH = '/copy-of-toastmaster-slot-booker';

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
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching assets:', urlsToCache);
        // Don't fail if some URLs fail to cache (external CDNs might block)
        return Promise.all(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.warn(`Failed to cache ${url}:`, err);
            })
          )
        );
      })
      .catch(err => {
        console.error('Cache open failed:', err);
      })
  );
  self.skipWaiting();
});

// Activate SW and remove old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
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

  // For app assets: Cache first strategy
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request because it's a one-time use stream
        const fetchRequest = request.clone();

        return fetch(fetchRequest)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache successful responses
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Cache app assets
                if (url.pathname.includes(BASE_PATH) || url.hostname === 'cdn.tailwindcss.com') {
                  cache.put(request, responseToCache);
                }
              });

            return response;
          })
          .catch(() => {
            // Network failed, try cache
            return caches.match(request);
          });
      })
  );
});
