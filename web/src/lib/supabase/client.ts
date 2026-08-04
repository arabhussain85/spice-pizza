import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key). Safe for the client bundle.
 * Used for live reads + Realtime subscriptions in Client Components.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
