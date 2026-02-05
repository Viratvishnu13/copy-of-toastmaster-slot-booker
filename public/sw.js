// Cache version with timestamp for automatic invalidation
const CACHE_VERSION = 'tm-booker-v7';
const CACHE_NAME = `${CACHE_VERSION}-${Date.now()}`;
const BASE_PATH = '';

// Check if we're in development mode (localhost or 127.0.0.1)
const isDevelopment = self.location.hostname === 'localhost' || 
                      self.location.hostname === '127.0.0.1' ||
                      self.location.hostname.includes('localhost');

// Assets to cache - using relative paths for GitHub Pages
// Note: External CDNs (Tailwind, Google Fonts) are not cached due to CORS restrictions
const urlsToCache = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/manifest.json'
  // logo.png and external resources are loaded but not cached by SW
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

// Handle push notifications (for background notifications)
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let notificationData = {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/copy-of-toastmaster-slot-booker/logo.png',
    badge: '/copy-of-toastmaster-slot-booker/logo.png',
    tag: 'tm-push-notification',
    requireInteraction: false
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || notificationData.tag,
        requireInteraction: data.requireInteraction || false,
        data: data.data || {}
      };
    } catch (e) {
      // If JSON parsing fails, try text
      const text = event.data.text();
      if (text) {
        notificationData.body = text;
      }
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      actions: notificationData.data?.actions || []
    })
  );
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
  // External CDNs (Tailwind, Google Fonts, etc.) should bypass SW entirely
  if (!url.pathname.includes(BASE_PATH) && url.origin !== self.location.origin) {
    // Let browser handle external resources normally (no SW interception)
    return;
  }

  // For app assets: Network First strategy (better for development/testing)
  // In development, always fetch fresh. In production, try network first, fallback to cache
  if (isDevelopment) {
    // Development: Network only, don't cache aggressively
    event.respondWith(
      fetch(request)
        .then(response => {
          // Return response even if it's an error (let browser handle it)
          if (!response || response.status === 404) {
            // For 404s, don't cache, just return the error response
            return response;
          }
          return response;
        })
        .catch(() => {
          // Only use cache if network completely fails
          return caches.match(request).then(cachedResponse => {
            return cachedResponse || new Response('Network error', { status: 408 });
          });
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
              // Only cache app assets that are part of our base path
              if (url.pathname.includes(BASE_PATH)) {
                cache.put(request, responseToCache).catch(err => {
                  console.warn('Cache put failed:', err);
                });
              }
            });
            
            return response;
          }
          // If network response is invalid (404, etc.), try cache
          if (response && response.status === 404) {
            return caches.match(request).then(cachedResponse => {
              return cachedResponse || response; // Return 404 if not in cache
            });
          }
          // For other errors, try cache
          return caches.match(request).then(cachedResponse => {
            return cachedResponse || response;
          });
        })
        .catch((error) => {
          // Network failed completely, try cache
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If no cache and network failed, return a proper error response
            return new Response('Network error', { 
              status: 408,
              statusText: 'Request Timeout'
            });
          });
        })
    );
  }
});
