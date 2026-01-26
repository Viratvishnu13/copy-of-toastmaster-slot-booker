# Push Notification Server

This server handles sending push notifications using Web Push Protocol (VAPID keys).

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (from Supabase dashboard)
- `VAPID_PRIVATE_KEY`: Your VAPID private key (get this from Firebase Console or generate new pair)

### 3. Get VAPID Private Key

If you only have the public key, you need to get the private key from:
- Firebase Console → Cloud Messaging → Web Push certificates
- Or generate a new pair using: `npx web-push generate-vapid-keys`

### 4. Run Locally

```bash
npm start
# or for development with auto-reload
npm run dev
```

Server will run on `http://localhost:3001`

## Deployment Options

### Option 1: Vercel (Recommended - Free)

1. Install Vercel CLI: `npm i -g vercel`
2. In the `server/` directory: `vercel`
3. Set environment variables in Vercel dashboard
4. Your API will be at: `https://your-project.vercel.app/api/send-push`

### Option 2: Netlify Functions

1. Install Netlify CLI: `npm i -g netlify-cli`
2. Create `netlify.toml`:
```toml
[build]
  functions = "."
```

3. Deploy: `netlify deploy --prod`
4. Set environment variables in Netlify dashboard

### Option 3: Railway (Easy Node.js hosting)

1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select this repository
4. Set environment variables
5. Deploy!

### Option 4: Render

1. Go to [render.com](https://render.com)
2. New Web Service
3. Connect GitHub repo
4. Set environment variables
5. Deploy!

## API Endpoints

### Send Push to User
```
POST /api/send-push
Body: {
  "userId": "user-uuid",
  "title": "Notification Title",
  "body": "Notification Body",
  "data": {} // optional
}
```

### Send Push to All Users
```
POST /api/send-push-all
Body: {
  "title": "Notification Title",
  "body": "Notification Body",
  "data": {} // optional
}
```

### Health Check
```
GET /api/health
```

## Integration with Your App

After deployment, update your notification sending code to call this API:

```typescript
// In components/Profile.tsx or services/store.ts
const sendPushNotification = async (userId: string, title: string, body: string) => {
  const response = await fetch('https://your-server.vercel.app/api/send-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, title, body })
  });
  return response.json();
};
```

## Testing

```bash
# Test health endpoint
curl https://your-server.vercel.app/api/health

# Test push notification
curl -X POST https://your-server.vercel.app/api/send-push \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid-here",
    "title": "Test Notification",
    "body": "This is a test!"
  }'
```
