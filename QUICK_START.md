# Quick Start - Push Notifications Setup

## 🚀 5-Minute Setup

### Step 1: Deploy Server (Vercel - Free)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy server
cd server
npm install
vercel
```

When prompted:
- ✅ Set up and deploy? **Yes**
- ✅ Link to existing project? **No** (create new)
- ✅ Project name? **toastmaster-push-server**

### Step 2: Set Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

**Get VAPID Private Key:**
- Firebase Console → Cloud Messaging → Web Push certificates
- Or generate: `npx web-push generate-vapid-keys`

### Step 3: Get Server URL

After deployment, Vercel gives you a URL like:
```
https://toastmaster-push-server.vercel.app
```

### Step 4: Configure Frontend

Create `.env.local` in root:
```env
VITE_PUSH_SERVER_URL=https://toastmaster-push-server.vercel.app
```

### Step 5: Deploy Frontend

```bash
npm run build
npm run deploy
```

### Step 6: Set Up Database

Run SQL from `DATABASE_SCHEMA.md` in Supabase SQL Editor.

### Step 7: Test!

1. Login → Profile → Enable Push Notifications
2. As admin → Send custom message
3. Check if notification appears (even with browser closed!)

## ✅ Done!

Your push notifications are now working! 🎉

## Troubleshooting

**Server not working?**
- Check Vercel logs: Dashboard → Functions → Logs
- Verify environment variables are set
- Test API: `curl https://your-server.vercel.app/api/health`

**Push not received?**
- Check browser console for errors
- Verify subscription in `push_subscriptions` table
- Make sure user enabled push in Profile settings
