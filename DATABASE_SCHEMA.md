# Database Schema - Device Tracking

## Devices Table

This table tracks devices and their associated users for efficient notification delivery.

### SQL to create the `devices` table:

```sql
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,                    -- Device fingerprint/ID (generated client-side)
  user_id UUID REFERENCES users(id),     -- Currently logged-in user (NULL if guest/logged out)
  last_login_at TIMESTAMPTZ,             -- Last time a user logged in on this device
  user_agent TEXT,                       -- Browser user agent string
  created_at TIMESTAMPTZ DEFAULT NOW(),  -- When device was first registered
  updated_at TIMESTAMPTZ DEFAULT NOW()  -- Last update timestamp
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_login ON devices(last_login_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own device records
CREATE POLICY "Users can view their own devices"
  ON devices FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Anyone can insert/update device records (for device registration)
CREATE POLICY "Anyone can register devices"
  ON devices FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update devices"
  ON devices FOR UPDATE
  USING (true);
```

### Usage:

1. **Device Registration**: When a user logs in, the device is registered/updated with their user_id
2. **Device Tracking**: Each device gets a unique ID stored in localStorage
3. **Notification Routing**: Notifications can be sent to specific devices based on user_id
4. **Multi-Device Support**: Users can be logged in on multiple devices

### Notes:

- Device IDs are generated client-side using browser fingerprinting
- The same device can have different user_ids over time (when different users log in)
- When a user logs out, user_id is set to NULL but device record remains
- This enables efficient notification delivery without requiring push notification services

---

## Push Subscriptions Table

This table stores web push notification subscriptions for background notifications.

### SQL to create the `push_subscriptions` table:

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,                    -- Push subscription endpoint
  p256dh TEXT NOT NULL,                      -- Public key for encryption
  auth TEXT NOT NULL,                        -- Authentication secret
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own push subscriptions
CREATE POLICY "Users can view their own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert/update their own push subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);
```

### Usage:

1. **Subscription Storage**: When a user subscribes to push notifications, the subscription is stored here
2. **Notification Delivery**: Server-side code can query this table to send push notifications to specific users
3. **Multi-Device Support**: Users can have multiple push subscriptions (one per device)
4. **Cleanup**: Subscriptions are automatically deleted when device or user is deleted (CASCADE)
