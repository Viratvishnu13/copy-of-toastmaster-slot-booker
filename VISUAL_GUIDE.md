# Visual Guide - Notification Center

## 🔔 Where to Find It

```
┌─────────────────────────────────────────┐
│  App Header                      🔔     │  ← CLICK HERE (Bell Icon)
├─────────────────────────────────────────┤
│                                         │
│  Main Content Area                      │
│  (Agenda / Calendar / Profile)          │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  📋  🗓️  👤                              │  ← Bottom Navigation
└─────────────────────────────────────────┘
```

---

## 📲 Notification Center Layout

When you click the bell icon, a modal slides up from the bottom:

```
┌──────────────────────────────────────┐
│ Notification Center              ×   │
├──────────────────────────────────────┤
│                                      │
│ Permission Status: [GRANTED/DENIED]  │
│ [Enable Notifications Button]        │
│                                      │
├──────────────────────────────────────┤
│                                      │
│ TEST NOTIFICATION                    │
│ ─────────────────────────────────── │
│ Title: [____________]                │
│ Message: [________________]           │
│                                      │
│ [🧪 Send Test Notification]          │
│                                      │
├──────────────────────────────────────┤
│                                      │
│ SEND CUSTOM MESSAGE                  │
│ ─────────────────────────────────── │
│ ☐ Send to All Users (checked)        │
│ (If unchecked: [Select User ▼])      │
│                                      │
│ Title: [____________]                │
│ Message: [________________]           │
│                                      │
│ [📤 Send Message]                    │
│                                      │
└──────────────────────────────────────┘
```

---

## 🎯 Usage Flow

### Send Test Notification
```
Click Bell Icon
    ↓
Check Permission Status
    ↓
If "default" → Click "Enable Notifications" & Accept Browser Prompt
    ↓
Go to "Test Notification" section
    ↓
(Optional) Type custom title/message
    ↓
Click "🧪 Send Test Notification"
    ↓
Notification appears! (if app is not focused)
```

### Send Custom Message to All Users
```
Click Bell Icon
    ↓
Ensure permission is "granted"
    ↓
Go to "Send Custom Message" section
    ↓
Keep "Send to All Users" toggled ON
    ↓
Enter Title: "Meeting Reminder"
Enter Message: "Don't forget the 6 PM meeting!"
    ↓
Click "📤 Send Message"
    ↓
All logged-in users receive notification
```

### Send Custom Message to Specific User
```
Click Bell Icon
    ↓
Ensure permission is "granted"
    ↓
Go to "Send Custom Message" section
    ↓
Toggle "Send to All Users" OFF
    ↓
Click dropdown & select user
    ↓
Enter Title and Message
    ↓
Click "📤 Send Message"
    ↓
Only selected user receives notification
```

---

## 💬 Example Messages You Can Send

### Meeting Reminders
- **Title:** "Don't Forget Tomorrow! 📅"
- **Message:** "We have our meeting tomorrow at 7 PM. See you there!"

### Urgent Updates
- **Title:** "Important Update ⚠️"
- **Message:** "The venue has changed. Check the agenda for details."

### Speaker Motivation
- **Title:** "You've Got This! 💪"
- **Message:** "Your speech is coming up. You're going to be amazing!"

### Event Announcements
- **Title:** "New Event Added!"
- **Message:** "A special workshop has been scheduled for next Sunday."

---

## ⚙️ Permission Management

### Notification Status States

| Status | Meaning | Action |
|--------|---------|--------|
| **granted** | ✅ Notifications enabled | Ready to use |
| **denied** | ❌ Blocked by user | User must re-enable in browser settings |
| **default** | ⏳ Not yet asked | Click "Enable Notifications" button |
| **unsupported** | ❌ Browser doesn't support | Use modern browser (Chrome, Firefox, Edge, Safari) |

### How to Grant Permission

**First Time:**
- Click "Enable Notifications" in Notification Center
- Accept browser prompt
- Permission granted!

**After Denying:**
- Browser → Settings → Notifications
- Find "Toastmasters Slot Booker"
- Change from "Block" to "Allow"

---

## 🧪 Testing Scenarios

### Scenario 1: Basic Test (No Setup Needed)
```
1. Open app
2. Click bell icon
3. Click "Enable Notifications"
4. Accept browser prompt
5. Send test notification
6. Minimize app or switch to another tab
7. You should see notification! ✓
```

### Scenario 2: Real-Time Message (Database Setup Required)
```
1. Open app in 2 browser windows side-by-side
2. In Window 1: Click bell icon
3. In Window 1: Type message "Testing" in custom message
4. In Window 1: Click "Send Message"
5. In Window 2: You should receive notification in real-time ✓
```

### Scenario 3: Send to Specific User
```
1. Have database with multiple users
2. Click bell icon
3. Toggle off "Send to All Users"
4. Select a specific user from dropdown
5. Type message
6. Send message
7. Only that user gets the notification ✓
```

---

## 🔍 How to Verify It's Working

### Check Service Worker
- Press F12 → Application tab
- Go to Service Workers
- You should see 1 registered Service Worker
- URL should end with `/sw.js`

### Check Cache
- Press F12 → Application tab
- Go to Cache Storage
- Click "tm-booker-v3"
- Should see cached assets

### Check Manifest
- Press F12 → Application tab
- Go to Manifest
- Should show app details and icons

### Check Console
- Press F12 → Console tab
- Look for messages like:
  - "ServiceWorker registration successful..."
  - "Notification sent..."

---

## ❌ Common Issues & Fixes

### Issue: Bell icon doesn't appear
**Solution:** Hard refresh (Ctrl+Shift+R)

### Issue: "Enable Notifications" button doesn't work
**Solution:** Check browser has notification permission (not globally blocked)

### Issue: Notification doesn't appear
**Solution:** Make sure app is NOT focused (minimize it or switch tabs)

### Issue: Service Worker shows "unregistered"
**Solution:** Hard refresh and check console for errors

### Issue: "Send Message" fails
**Solution:** Make sure database is configured and user is logged in

---

## 📚 More Information

See detailed guides:
- [NOTIFICATION_PWA_SETUP.md](./NOTIFICATION_PWA_SETUP.md) - Full setup guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - What was changed
- [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) - Complete checklist

---

**You're all set! Start sending notifications! 🚀**
