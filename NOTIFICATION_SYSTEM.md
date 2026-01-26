# Notification System Documentation

## How Notifications Work

### Current Implementation

1. **When Notifications Appear:**
   - ✅ When browser is minimized
   - ✅ When browser is in a different tab
   - ✅ When app is in background
   - ⚠️ When browser is completely closed: **Limited** (requires PWA installation and browser background processes)

2. **Notification Types:**
   - **Meeting Reminders**: Sent 24 hours before meetings
   - **Role Reminders**: Sent 24 hours before user's assigned roles
   - **New Meeting Alerts**: Real-time when new meetings are created
   - **Admin Broadcasts**: Custom messages from admins

### Device Tracking System

The app now tracks devices and their associated users:

- **Device ID**: Unique fingerprint stored in localStorage (persists across sessions)
- **User Mapping**: Each device is linked to the last logged-in user
- **Multi-User Support**: If multiple users login on the same device, the last login is tracked

### How Device Tracking Works

1. **On Login**: Device is registered/updated with the logged-in user's ID
2. **On Logout**: Device's user_id is cleared (set to NULL)
3. **On Session Restore**: Device is re-registered with the restored user
4. **Database**: All device records are stored in the `devices` table

### Notification Delivery

**Current System (Realtime Subscriptions):**
- Uses Supabase Realtime channels
- Works when browser/app is open
- Notifications are delivered via WebSocket connections
- **Limitation**: Requires active browser connection

**For Browser-Closed Notifications:**
To enable notifications when the browser is completely closed, you would need:

1. **Push API Integration** (requires backend service):
   - Firebase Cloud Messaging (FCM)
   - Web Push Protocol with a push service
   - Custom push notification server

2. **Service Worker Background Sync**:
   - Periodic background sync (limited browser support)
   - Background fetch API

3. **PWA Installation**:
   - App must be installed as PWA
   - Browser must support background processes
   - OS-level notification permissions

### Current Limitations

- **Browser Closed**: Notifications won't work if browser is completely closed (no JavaScript running)
- **Realtime Dependency**: Requires active Supabase connection
- **No Push Service**: Currently no push notification service integrated

### Future Enhancements

To enable true background notifications:

1. **Add Push API**:
   ```typescript
   // Register for push notifications
   const registration = await navigator.serviceWorker.ready;
   const subscription = await registration.pushManager.subscribe({
     userVisibleOnly: true,
     applicationServerKey: VAPID_PUBLIC_KEY
   });
   ```

2. **Backend Push Service**:
   - Send push notifications via FCM or Web Push Protocol
   - Store push subscriptions in database
   - Send notifications to specific devices/users

3. **Background Sync**:
   - Use Service Worker background sync
   - Periodic background checks for new notifications

### Device-User Mapping

The `devices` table tracks:
- `id`: Unique device identifier
- `user_id`: Currently logged-in user (NULL if guest/logged out)
- `last_login_at`: Timestamp of last login
- `user_agent`: Browser information

This enables:
- Efficient notification routing
- Multi-device support per user
- Device-specific notification preferences (future)

### Notification Settings

Users can control:
- **Suppress when visible**: Hide notifications when app is open (default: enabled)
- **Permission status**: Enable/disable browser notifications
- **Test notifications**: Send test notifications to verify setup

### Database Schema

See `DATABASE_SCHEMA.md` for the `devices` table schema and setup instructions.
