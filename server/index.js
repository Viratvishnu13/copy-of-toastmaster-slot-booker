/**
 * Push Notification Server
 * Uses Web Push Protocol with VAPID keys (works with your existing VAPID key)
 * 
 * Note: Firebase Admin SDK is for FCM (Firebase Cloud Messaging), which is different.
 * Since you have a VAPID key, we use 'web-push' library which is the standard for Web Push.
 * 
 * If you want to use Firebase Admin SDK for FCM instead, you'll need:
 * 1. Firebase service account JSON file
 * 2. Convert Web Push subscriptions to FCM tokens
 * 3. Use admin.messaging().send() instead
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const app = express();
app.use(express.json());

// CORS middleware - Handle preflight requests properly
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://viratvishnu13.github.io',
    'http://localhost:3000',
    'http://localhost:4173',
    'https://copy-of-toastmaster-slot-booker.vercel.app'
  ];
  
  // Logic: Is this a trusted origin?
  // We trust: 
  // 1. Exact matches in allowedOrigins
  // 2. Any subdomains of vercel.app (for previews)
  // 3. GitHub Pages
  const isAllowed = origin && (
    allowedOrigins.includes(origin) || 
    origin.endsWith('.vercel.app') || 
    origin.includes('github.io')
  );

  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    // Fallback for tools like Postman (optional)
    res.header('Access-Control-Allow-Origin', '*');
    // We do NOT set credentials to true here to avoid the conflict
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Set VAPID keys for web push
const VAPID_PUBLIC_KEY = 'BIfw94xz-PKU3-nm_zQDLPdva9nbrEn3ae0mNBGQ5Y4ec7D3cRaZ-1jSosMx0TBNrvskvNf9-9C8iY5EZHGY9N8';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY; // Set this as environment variable

webpush.setVapidDetails(
  'mailto:your-email@example.com', // Your contact email
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/**
 * Send push notification to a specific user
 * POST /api/send-push
 * Body: { userId: string, title: string, body: string, data?: object }
 */
app.post('/api/send-push', async (req, res) => {
  try {
    const { userId, title, body, data = {} } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ error: 'Missing required fields: userId, title, body' });
    }

    // Get all push subscriptions for this user
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ error: 'No push subscriptions found for user' });
    }

    // Send push notification to all user's devices
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const payload = JSON.stringify({
          title,
          body,
          icon: 'https://viratvishnu13.github.io/copy-of-toastmaster-slot-booker/logo.png',
          badge: 'https://viratvishnu13.github.io/copy-of-toastmaster-slot-booker/logo.png',
          data: {
            url: 'https://viratvishnu13.github.io/copy-of-toastmaster-slot-booker/',
            ...data
          }
        });

        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            },
            payload
          );
          return { deviceId: sub.device_id, success: true };
        } catch (error) {
          // If subscription is invalid (410), delete it
          if (error.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('device_id', sub.device_id);
            console.log(`Deleted invalid subscription: ${sub.device_id}`);
          }
          return { deviceId: sub.device_id, success: false, error: error.message };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    res.json({
      success: true,
      sent: successful,
      failed,
      total: subscriptions.length
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send push notification to all users
 * POST /api/send-push-all
 * Body: { title: string, body: string, data?: object }
 */
app.post('/api/send-push-all', async (req, res) => {
  try {
    const { title, body, data = {} } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Missing required fields: title, body' });
    }

    // Get all push subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ error: 'No push subscriptions found' });
    }

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const payload = JSON.stringify({
          title,
          body,
          icon: 'https://viratvishnu13.github.io/copy-of-toastmaster-slot-booker/logo.png',
          badge: 'https://viratvishnu13.github.io/copy-of-toastmaster-slot-booker/logo.png',
          data: {
            url: 'https://viratvishnu13.github.io/copy-of-toastmaster-slot-booker/',
            ...data
          }
        });

        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            },
            payload
          );
          return { deviceId: sub.device_id, success: true };
        } catch (error) {
          if (error.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('device_id', sub.device_id);
          }
          return { deviceId: sub.device_id, success: false, error: error.message };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    res.json({
      success: true,
      sent: successful,
      failed,
      total: subscriptions.length
    });
  } catch (error) {
    console.error('Error sending push notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// For Vercel/Netlify serverless
if (process.env.VERCEL || process.env.NETLIFY) {
  module.exports = app;
} else {
  // For standalone server
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Push notification server running on port ${PORT}`);
  });
}
