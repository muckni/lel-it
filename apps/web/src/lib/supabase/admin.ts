import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — server-only. Never import in client components.
 * Requires SUPABASE_SERVICE_ROLE_KEY env var.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
