import type { NextConfig } from "next";

// Origen de Supabase (auth desde el navegador) para permitirlo en connect-src.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

/**
 * Content-Security-Policy.
 * - frame-ancestors 'none' + X-Frame-Options: bloquean clickjacking (embeber la app en un iframe).
 * - script-src 'unsafe-inline': Next inyecta scripts inline de hidratación; sin nonce por request
 *   no hay forma de evitarlo. NO se permite 'unsafe-eval' (no hace falta en producción).
 * - style-src 'unsafe-inline': la app usa estilos inline (prop style=) que se renderizan en SSR.
 * - img-src https: data: blob:: miniaturas y avatares vienen del CDN de Instagram (hosts variables).
 * - connect-src: solo el propio origen y Supabase (auth).
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Sin includeSubDomains/preload: la app vive en un subdominio de vercel.app y no
  // debe imponer HSTS al dominio padre compartido.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  // Permite cargar los assets de dev cuando entrás por un túnel HTTPS (cloudflared)
  // en lugar de localhost. Sin esto, Next 16 bloquea los chunks y la app no arranca.
  allowedDevOrigins: ["*.trycloudflare.com"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
