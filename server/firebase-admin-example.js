/**
 * Firebase Admin SDK Example (Alternative Implementation)
 * 
 * NOTE: This requires Firebase service account and FCM setup.
 * Your VAPID key is for Web Push Protocol, not FCM.
 * 
 * To use this instead of web-push:
 * 1. Get Firebase service account JSON from Firebase Console
 * 2. Install: npm install firebase-admin
 * 3. Replace web-push code with this implementation
 */

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Initialize Firebase Admin
const serviceAccount = require('./firebase-service-account.json'); // Download from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Send push using Firebase Admin SDK (FCM)
 * 
 * Note: Web Push subscriptions need to be converted to FCM tokens
 * This is more complex than using web-push library directly
 */
async function sendPushNotificationFCM(userId, title, body, data = {}) {
  try {
    // Get push subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, message: 'No subscriptions found' };
    }

    // Convert Web Push endpoints to FCM tokens
    // This requires additional setup - FCM tokens are different from Web Push endpoints
    const fcmTokens = subscriptions.map(sub => {
      // Extract FCM token from endpoint or store separately
      // For FCM, you'd typically store FCM tokens in a separate field
      return sub.fcm_token || sub.endpoint; // This is simplified
    });

    // Send via FCM
    const message = {
      notification: {
        title: title,
        body: body
      },
      data: data,
      tokens: fcmTokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    return {
      success: true,
      sent: response.successCount,
      failed: response.failureCount
    };
  } catch (error) {
    console.error('FCM send error:', error);
    throw error;
  }
}

module.exports = { sendPushNotificationFCM };

/**
 * IMPORTANT: 
 * - FCM (Firebase Admin SDK) and Web Push Protocol (VAPID) are DIFFERENT
 * - Your VAPID key won't work with Firebase Admin SDK directly
 * - Use web-push library (in index.js) for VAPID keys
 * - Use Firebase Admin SDK only if you have Firebase service account
 */
