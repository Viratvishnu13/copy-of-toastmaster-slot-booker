import { supabase } from './supabaseClient';
import { DeviceService } from './deviceService';

/**
 * Web Push Notification Service
 * Handles push notification subscriptions and registration
 */

// VAPID Public Key (from Firebase or your push service)
const VAPID_PUBLIC_KEY = 'BIfw94xz-PKU3-nm_zQDLPdva9nbrEn3ae0mNBGQ5Y4ec7D3cRaZ-1jSosMx0TBNrvskvNf9-9C8iY5EZHGY9N8';

// Convert VAPID key to Uint8Array (required by Push API)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const PushService = {
  /**
   * Check if push notifications are supported
   */
  isSupported: (): boolean => {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  },

  /**
   * Subscribe to push notifications
   */
  subscribe: async (userId: string): Promise<PushSubscription | null> => {
    if (!PushService.isSupported()) {
      console.warn('Push notifications are not supported in this browser');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Subscribe to push notifications
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
      }

      // Store subscription in database
      await PushService.saveSubscription(subscription, userId);

      console.log('✅ Push subscription successful');
      return subscription;
    } catch (error) {
      console.error('❌ Push subscription failed:', error);
      return null;
    }
  },

  /**
   * Unsubscribe from push notifications
   */
  unsubscribe: async (): Promise<boolean> => {
    if (!PushService.isSupported()) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await PushService.deleteSubscription(subscription);
        console.log('✅ Push unsubscribed');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Push unsubscribe failed:', error);
      return false;
    }
  },

  /**
   * Get current subscription
   */
  getSubscription: async (): Promise<PushSubscription | null> => {
    if (!PushService.isSupported()) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      return await registration.pushManager.getSubscription();
    } catch (error) {
      console.error('Failed to get subscription:', error);
      return null;
    }
  },

  // Inside services/pushService.ts

  saveSubscription: async (subscription: PushSubscription, userId: string) => {
    try {
      // DEBUG 1: Did we get a subscription object?
      // alert("Step 1: Got subscription from browser"); 

      const deviceId = await DeviceService.getDeviceId();
      if (!deviceId) {
        alert("❌ Error: Device ID is missing!");
        return;
      }
      
      // DEBUG 2: Preparing to save
      // alert(`Step 2: Saving for Device ${deviceId}`);

      // 3. Upsert to Supabase
      const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert({
          device_id: deviceId, // This MUST match your DB column name
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: (subscription.getKey('p256dh') ? 
            btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh') as ArrayBuffer) as any)) : ''),
          auth: (subscription.getKey('auth') ? 
            btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth') as ArrayBuffer) as any)) : '')
        }, {
          onConflict: 'device_id'
        })
        .select(); // Add .select() to see if it actually returns data

      if (error) {
        alert("❌ Database Error: " + error.message);
        console.error("Supabase Error:", error);
      } else {
        alert("✅ Notification enabled successfully");
      }

    } catch (err: any) {
      alert("❌ Critical Crash: " + err.message);
    }
  },
  
  /**
   * Delete subscription from database
   */
  deleteSubscription: async (subscription: PushSubscription): Promise<void> => {
    const deviceId = DeviceService.getDeviceId();

    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('device_id', deviceId);

      if (error) {
        console.error('Error deleting push subscription:', error);
      }
    } catch (error) {
      console.error('Failed to delete push subscription:', error);
    }
  },

  /**
   * Check subscription status
   */
  getSubscriptionStatus: async (): Promise<'subscribed' | 'not-subscribed' | 'unsupported'> => {
    if (!PushService.isSupported()) {
      return 'unsupported';
    }

    const subscription = await PushService.getSubscription();
    return subscription ? 'subscribed' : 'not-subscribed';
  }
};
