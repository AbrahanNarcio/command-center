import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. SERVER ONLY — bypasses RLS.
 * Never import this from a client component.
 */

let cached: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function adminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase no configurado (URL o SERVICE_ROLE_KEY faltante).");
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
