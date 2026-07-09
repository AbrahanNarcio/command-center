"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser client — only for auth (login/logout). Data always flows through our API. */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
