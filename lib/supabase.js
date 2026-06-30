import { createClient } from "@supabase/supabase-js";

// Server-only client using the service-role key. Never import this in
// client components. The app password gate (middleware) is the access control.
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
