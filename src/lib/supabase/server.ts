import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Auth-aware server client (reads the session from cookies). For identifying the user. */
export async function serverClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where cookies are read-only — safe to ignore,
          // the session refresh will happen in a Route Handler instead.
        }
      },
    },
  });
}
