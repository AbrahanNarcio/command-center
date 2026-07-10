import crypto from "crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Verificación de origen para mutaciones (defensa CSRF).
 * Si la petición trae header Origin, su host debe coincidir con el Host de la app.
 * Si no trae Origin (algunos clientes lo omiten en same-origin), se deja pasar:
 * la cookie de sesión sigue siendo SameSite=Lax, así que el vector real (form POST
 * cross-site) queda cubierto por la combinación de ambos.
 */
export async function sameOriginOk(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return true; // sin Origin: no es un POST cross-site de navegador
  const host = h.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Respuesta 403 estándar cuando el origen no coincide. */
export function crossOriginResponse(): NextResponse {
  return NextResponse.json({ error: "cross-origin" }, { status: 403 });
}

/** Comparación de secretos en tiempo constante (evita ataques de temporización). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/* ── Rate limiting en memoria (ventana deslizante por IP+clave) ──
 * Limitación conocida: la memoria no se comparte entre instancias serverless.
 * Aun así frena el abuso automatizado sostenido sobre una instancia caliente.
 * Para límites duros multi-instancia haría falta un store externo (Upstash/Redis). */
type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd?.split(",")[0].trim() || h.get("x-real-ip") || "unknown").slice(0, 64);
}

/** Devuelve true si se superó el límite (hay que rechazar). */
export async function rateLimited(key: string, max: number, windowMs: number): Promise<boolean> {
  const ip = await clientIp();
  const id = `${key}:${ip}`;
  const now = Date.now();
  const hit = buckets.get(id);
  if (!hit || hit.resetAt < now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    return false;
  }
  hit.count += 1;
  return hit.count > max;
}

export function tooManyResponse(): NextResponse {
  return NextResponse.json(
    { error: "Demasiados intentos. Espera un momento e inténtalo de nuevo." },
    { status: 429 },
  );
}

/* ── Fuerza de contraseña ── */
const COMMON = new Set([
  "password", "contrasena", "contraseña", "12345678", "123456789", "1234567890",
  "qwertyui", "password1", "iloveyou", "admin123", "letmein1", "welcome1",
]);

/**
 * Valida la fuerza de una contraseña. Mínimo 12, con variedad de caracteres,
 * y consulta HaveIBeenPwned (k-anonymity: solo se envían 5 chars del hash SHA-1)
 * para rechazar contraseñas ya filtradas en brechas conocidas.
 * Devuelve un mensaje de error o null si es válida.
 */
export async function passwordProblem(pw: string): Promise<string | null> {
  if (pw.length < 12) return "La contraseña debe tener al menos 12 caracteres.";
  if (COMMON.has(pw.toLowerCase())) return "Esa contraseña es demasiado común.";
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (classes < 3) {
    return "Usa al menos 3 de: minúsculas, mayúsculas, números y símbolos.";
  }
  try {
    const sha1 = crypto.createHash("sha1").update(pw).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const body = await res.text();
      for (const line of body.split("\n")) {
        const [hash, countStr] = line.trim().split(":");
        if (hash === suffix && Number(countStr) > 0) {
          return "Esta contraseña apareció en una filtración de datos conocida. Elige otra.";
        }
      }
    }
  } catch {
    // Si HIBP no responde, no bloqueamos: ya validamos longitud y variedad.
  }
  return null;
}
