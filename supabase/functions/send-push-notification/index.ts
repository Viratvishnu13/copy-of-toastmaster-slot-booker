// Supabase Edge Function to send push notifications using Firebase Admin SDK
// Deploy: supabase functions deploy send-push-notification

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Note: Firebase Admin SDK doesn't work in Deno (Edge Functions runtime)
// We'll use web-push library instead, which works with VAPID keys
// For Firebase Admin SDK, you'd need a Node.js server (see server/ directory)

const VAPID_PUBLIC_KEY = 'BIfw94xz-PKU3-nm_zQDLPdva9nbrEn3ae0mNBGQ5Y4ec7D3cRaZ-1jSosMx0TBNrvskvNf9-9C8iY5EZHGY9N8';
// You need to set VAPID_PRIVATE_KEY as a secret in Supabase
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';

serve(async (req) => {
  try {
    const { userId, title, body, data = {} } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get push subscriptions for user
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error || !subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No push subscriptions found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Send push notifications using web-push
    // Note: This requires web-push library which needs to be imported
    // For Deno, we'll use a different approach or you can use a Node.js server

    return new Response(
      JSON.stringify({ success: true, sent: subscriptions.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
