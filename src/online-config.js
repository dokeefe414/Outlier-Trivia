// Public Supabase configuration. These are PUBLIC browser identifiers, not secrets.
// After you create a Supabase project and deploy its SQL/functions, enter its URL
// and anon/publishable key below. NEVER put a service_role or Stripe key here.
export const SUPABASE_URL = "https://ljmqtdwcwpatyecxtues.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_LOUIt4LU8uBSL9LDlAzPYg_ApxhTGuv";

export const ONLINE_ENABLED = Boolean(
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 20
);
