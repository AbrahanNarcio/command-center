import { NextRequest, NextResponse } from "next/server";

/**
 * Route guard: pages require a Supabase session cookie; otherwise redirect to /login.
 * Real authorization (roles) happens server-side in each API route — this is just
 * the front door. API routes return 401/403 on their own.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Supabase puede trocear la cookie (sb-xxx-auth-token.0, .1, ...): usar includes.
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token") && c.value);

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
