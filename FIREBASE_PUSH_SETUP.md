# Firebase Push Notifications Setup Guide

## Overview

This app now supports Web Push Notifications using Firebase Cloud Messaging (FCM) or the Web Push Protocol. The client-side is already implemented - you need to set up the server-side to send push notifications.

## VAPID Key

The public VAPID key is already configured:
```
BIfw94xz-PKU3-nm_zQDLPdva9nbrEn3ae0mNBGQ5Y4ec7D3cRaZ-1jSosMx0TBNrvskvNf9-9C8iY5EZHGY9N8
```

## Client-Side Implementation (✅ Already Done)

1. **Push Service**: `services/pushService.ts` - Handles subscription management
2. **Service Worker**: `public/sw.js` - Handles push events
3. **UI**: Profile page has push notification enable/disable controls

## Server-Side Setup Required

**Important**: Your VAPID key is for **Web Push Protocol**, not FCM. The server uses `web-push` library (not Firebase Admin SDK) which works with VAPID keys.

If you specifically want Firebase Admin SDK for FCM, you'll need:
- Firebase service account JSON
- Convert Web Push subscriptions to FCM tokens
- Different implementation (see Option 2 below)

### Option 1: Web Push Protocol (Recommended - Works with Your VAPID Key) ✅

This is what's implemented in `server/index.js`. It uses the `web-push` library with your VAPID key.

**Deploy the server** (see `DEPLOYMENT_GUIDE.md`):
1. Go to `server/` directory
2. Run `npm install`
3. Deploy to Vercel: `vercel`
4. Set environment variables
5. Done!

### Option 2: Firebase Admin SDK (FCM) - Alternative

#### 1. Install Firebase Admin SDK

```bash
npm install firebase-admin
```

#### 2. Initialize Firebase Admin

```javascript
// server/firebase-admin.js
const admin = require('firebase-admin');

// Initialize with service account
const serviceAccount = require('./path-to-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
```

#### 3. Send Push Notification Function

```javascript
// server/send-push.js
const admin = require('./firebase-admin');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendPushNotification(userId, title, body, data = {}) {
  try {
    // Get all push subscriptions for this user
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error || !subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return;
    }

    // Send to all user's devices
    const messages = subscriptions.map(sub => ({
      webpush: {
        notification: {
          title: title,
          body: body,
          icon: 'https://your-domain.com/logo.png',
          badge: 'https://your-domain.com/logo.png',
          requireInteraction: false
        },
        data: data
      },
      token: sub.endpoint // FCM uses endpoint as token
    }));

    // Note: For FCM, you need to convert Web Push subscription to FCM token
    // Or use Web Push Protocol directly (see Option 2)

    const response = await admin.messaging().sendAll(messages);
    console.log(`Successfully sent ${response.successCount} push notifications`);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

// Send to all users
async function sendPushToAll(title, body, data = {}) {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*');

  // Group by user and send
  // Implementation similar to above
}

module.exports = { sendPushNotification, sendPushToAll };
```

### Option 2: Web Push Protocol (Direct)

#### 1. Install web-push library

```bash
npm install web-push
```

#### 2. Send Push Notification Function

```javascript
// server/send-push.js
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Set VAPID keys
webpush.setVapidDetails(
  'mailto:your-email@example.com', // Contact email
  'BIfw94xz-PKU3-nm_zQDLPdva9nbrEn3ae0mNBGQ5Y4ec7D3cRaZ-1jSosMx0TBNrvskvNf9-9C8iY5EZHGY9N8', // Public key
  'YOUR_PRIVATE_VAPID_KEY' // Private key (keep secret!)
);

async function sendPushNotification(userId, title, body, data = {}) {
  try {
    // Get all push subscriptions for this user
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error || !subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return;
    }

    // Send to all user's devices
    const promises = subscriptions.map(async (sub) => {
      const payload = JSON.stringify({
        title: title,
        body: body,
        icon: 'https://your-domain.com/logo.png',
        badge: 'https://your-domain.com/logo.png',
        data: data
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
        console.log(`Push sent to device ${sub.device_id}`);
      } catch (error) {
        console.error(`Error sending to device ${sub.device_id}:`, error);
        // If subscription is invalid, delete it
        if (error.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('device_id', sub.device_id);
        }
      }
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

// Send to all users
async function sendPushToAll(title, body, data = {}) {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*');

  // Similar implementation
}

module.exports = { sendPushNotification, sendPushToAll };
```

## Integration with Existing Notification System

### Update Supabase Function or Edge Function

You can create a Supabase Edge Function or Database Trigger to send push notifications:

```sql
-- Example: Trigger to send push when notification is created
CREATE OR REPLACE FUNCTION send_push_on_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Call your server endpoint to send push
  -- This would be done via HTTP request to your server
  PERFORM net.http_post(
    url := 'https://your-server.com/api/send-push',
    body := json_build_object(
      'user_id', NEW.target_user_id,
      'title', NEW.title,
      'body', NEW.body
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_push_trigger
  AFTER INSERT ON notifications
  FOR EACH ROW
  WHEN (NEW.target_user_id IS NOT NULL)
  EXECUTE FUNCTION send_push_on_notification();
```

## Testing

1. **Enable Push Notifications**: Go to Profile → Notification Settings → Enable Push Notifications
2. **Check Database**: Verify subscription is saved in `push_subscriptions` table
3. **Send Test**: Use your server endpoint to send a test push notification
4. **Verify**: Notification should appear even when browser is closed (if PWA is installed)

## Important Notes

1. **VAPID Private Key**: Keep your private VAPID key secret! Never expose it in client-side code.
2. **HTTPS Required**: Push notifications only work over HTTPS (or localhost for development)
3. **PWA Installation**: For best results, users should install the app as a PWA
4. **Browser Support**: Chrome, Firefox, Edge support push notifications. Safari has limited support.
5. **Subscription Cleanup**: Invalid subscriptions (410 status) should be deleted from database

## Next Steps

1. Set up your server (Node.js, Python, etc.)
2. Install Firebase Admin SDK or web-push library
3. Create API endpoint to send push notifications
4. Integrate with your notification system
5. Test with real devices
