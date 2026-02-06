/**
 * Push Notification Server
 */
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const app = express();
app.use(express.json());

// 🟢 CONFIG: Your Vercel Frontend URL
const FRONTEND_URL = 'https://copy-of-toastmaster-slot-booker.vercel.app';

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4173',
    FRONTEND_URL
  ];
  
  const isAllowed = origin && (
    allowedOrigins.includes(origin) || 
    origin.endsWith('.vercel.app') || 
    origin.includes('github.io')
  );

  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
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

// Set VAPID keys
const VAPID_PUBLIC_KEY = 'BIfw94xz-PKU3-nm_zQDLPdva9nbrEn3ae0mNBGQ5Y4ec7D3cRaZ-1jSosMx0TBNrvskvNf9-9C8iY5EZHGY9N8';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/**
 * Send push notification to a specific user
 */
app.post('/api/send-push', async (req, res) => {
  try {
    const { userId, title, body, data = {} } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    if (!subscriptions?.length) return res.status(404).json({ error: 'No subscriptions found' });

    console.log(`[Push] Found ${subscriptions.length} devices for User ${userId}`);

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const payload = JSON.stringify({
          title,
          body,
          icon: `${FRONTEND_URL}/logo.png`,
          badge: `${FRONTEND_URL}/logo.png`,
          data: { url: `${FRONTEND_URL}/`, ...data }
        });

        try {
          // 🟡 LOGGING ADDED HERE
          console.log(`👉 Sending to Device ID: ${sub.device_id}`);

          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          
          console.log(`✅ Success Device ID: ${sub.device_id}`);
          return { deviceId: sub.device_id, success: true };
        } catch (error) {
          console.error(`❌ Failed Device ID: ${sub.device_id}`, error.message);

          if (error.statusCode === 410) {
            console.log(`🗑️ Deleting invalid subscription: ${sub.device_id}`);
            await supabase.from('push_subscriptions').delete().eq('device_id', sub.device_id);
          }
          return { deviceId: sub.device_id, success: false, error: error.message };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    res.json({ success: true, sent: successful, failed: results.length - successful });
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send push notification to all users
 */
app.post('/api/send-push-all', async (req, res) => {
  try {
    const { title, body, data = {} } = req.body;

    if (!title || !body) return res.status(400).json({ error: 'Missing required fields' });

    const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('*');

    if (error) return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    if (!subscriptions?.length) return res.status(404).json({ error: 'No subscriptions found' });

    console.log(`[Push Broadcast] Sending to ALL ${subscriptions.length} subscriptions`);

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const payload = JSON.stringify({
          title,
          body,
          icon: `${FRONTEND_URL}/logo.png`,
          badge: `${FRONTEND_URL}/logo.png`,
          data: { url: `${FRONTEND_URL}/`, ...data }
        });

        try {
          // 🟡 LOGGING ADDED HERE
          console.log(`👉 Broadcast to Device ID: ${sub.device_id}`);

          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          
          console.log(`✅ Success Device ID: ${sub.device_id}`);
          return { deviceId: sub.device_id, success: true };
        } catch (error) {
          console.error(`❌ Failed Device ID: ${sub.device_id}`, error.message);

          if (error.statusCode === 410) {
            console.log(`🗑️ Deleting invalid subscription: ${sub.device_id}`);
            await supabase.from('push_subscriptions').delete().eq('device_id', sub.device_id);
          }
          return { deviceId: sub.device_id, success: false, error: error.message };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    res.json({ success: true, sent: successful, failed: results.length - successful });
  } catch (error) {
    console.error('Error sending push notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}
