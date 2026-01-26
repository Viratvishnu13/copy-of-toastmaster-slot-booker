# Complete Deployment Guide - Push Notifications

## Overview

Your app has two parts:
1. **Frontend** (React app) → Deploy to GitHub Pages ✅
2. **Backend** (Push notification server) → Deploy to Vercel/Netlify/Railway

## Step 1: Deploy Frontend to GitHub Pages

Your frontend is already set up for GitHub Pages. Just run:

```bash
npm run build
npm run deploy
```

## Step 2: Set Up Push Notification Server

### Quick Setup (Vercel - Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy Server**:
   ```bash
   cd server
   vercel
   ```
   Follow the prompts. When asked:
   - "Set up and deploy?": Yes
   - "Which scope?": Your account
   - "Link to existing project?": No (create new)
   - "Project name?": toastmaster-push-server (or any name)

3. **Set Environment Variables**:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add VAPID_PRIVATE_KEY
   ```
   
   Or set them in Vercel Dashboard → Your Project → Settings → Environment Variables

4. **Get Your Server URL**:
   After deployment, Vercel will give you a URL like:
   `https://toastmaster-push-server.vercel.app`

### Get VAPID Private Key

You have the public key, but you need the private key:

**Option A: From Firebase Console**
1. Go to Firebase Console → Your Project
2. Settings → Cloud Messaging
3. Web Push certificates → Copy the private key

**Option B: Generate New Pair**
```bash
cd server
npx web-push generate-vapid-keys
```
This will give you both public and private keys. Update the public key in `services/pushService.ts` if you generate new ones.

## Step 3: Configure Frontend

1. **Create `.env.local` file** in the root directory:
   ```env
   VITE_PUSH_SERVER_URL=https://your-server.vercel.app
   ```

2. **Rebuild and Deploy**:
   ```bash
   npm run build
   npm run deploy
   ```

## Step 4: Set Up Database Tables

Run the SQL from `DATABASE_SCHEMA.md` in your Supabase SQL Editor:

1. Create `devices` table
2. Create `push_subscriptions` table

## Step 5: Test

1. **Enable Push Notifications**:
   - Login to your app
   - Go to Profile → Notification Settings
   - Click "Enable Push Notifications"
   - Accept browser permission

2. **Test Push Notification**:
   - As admin, go to Profile → Notification Center
   - Send a custom message
   - Check if push notification is sent (even with browser closed)

## Alternative: Use Supabase Edge Functions

If you prefer to keep everything in Supabase:

1. Install Supabase CLI: `npm i -g supabase`
2. Create edge function: `supabase functions new send-push`
3. Deploy: `supabase functions deploy send-push`
4. Set secrets: `supabase secrets set VAPID_PRIVATE_KEY=your-key`

See `supabase/functions/send-push-notification/index.ts` for example code.

## Troubleshooting

### Push Notifications Not Working?

1. **Check Browser Console**: Look for errors
2. **Check Server Logs**: Vercel Dashboard → Functions → Logs
3. **Verify Environment Variables**: Make sure all are set correctly
4. **Test API Directly**: Use curl or Postman to test `/api/send-push`
5. **Check Database**: Verify subscriptions are saved in `push_subscriptions` table

### Common Issues

- **"No push subscriptions found"**: User hasn't enabled push notifications
- **"Invalid subscription"**: Subscription expired, will be auto-deleted
- **"CORS error"**: Make sure server allows requests from your domain
- **"401 Unauthorized"**: Check SUPABASE_SERVICE_ROLE_KEY

## Production Checklist

- [ ] Server deployed and accessible
- [ ] Environment variables set
- [ ] Database tables created
- [ ] VAPID keys configured
- [ ] Frontend has `VITE_PUSH_SERVER_URL` set
- [ ] Test push notifications working
- [ ] HTTPS enabled (required for push notifications)

## Cost

- **GitHub Pages**: Free
- **Vercel**: Free tier (100GB bandwidth/month)
- **Supabase**: Free tier (500MB database, 2GB bandwidth)
- **Total**: $0/month for small to medium usage! 🎉
