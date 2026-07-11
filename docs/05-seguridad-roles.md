# 05 · Seguridad y roles

Código: [`src/lib/auth.ts`](../src/lib/auth.ts), [`src/lib/security.ts`](../src/lib/security.ts),
[`src/lib/crypto.ts`](../src/lib/crypto.ts), headers en [`next.config.ts`](../next.config.ts),
protección de rutas en [`src/proxy.ts`](../src/proxy.ts).

## Roles y gates

Tres roles en `profiles.role`: `admin`, `editor`, `client` (=viewer, nombre histórico).

- **`adminGate()`** — solo admin. Usado en cuentas y accesos de clientes.
- **`accountGate(accountId)`** — admin O editor cuya `account_id` sea exactamente esa cuenta.
  Usado en todo lo demás que muta (piezas, fuentes, métricas, reportes, conexión, sync).
- **`accountMemberGate(accountId)`** — admin O cualquier usuario (editor Y viewer) cuya
  `account_id` sea esa cuenta. Es la ÚNICA escritura permitida al viewer y hoy solo la usa
  POST `/api/reports` (generar un reporte de su propia cuenta). Eliminar/restaurar reportes
  sigue bajo `accountGate`. No reutilizarlo para otras mutaciones sin pensarlo dos veces.
- Ambos gates ejecutan PRIMERO `sameOriginOk()` (anti-CSRF, ver abajo) y devuelven
  `{ session, response }`: si `response` existe, la ruta lo retorna tal cual (401/403).
- En PATCH/DELETE la cuenta dueña de la fila se resuelve server-side con `rowAccountId(tabla, id)`
  — **nunca** se confía en un accountId del body.
- El bootstrap filtra por cuenta para no-admins; el viewer sin cuenta asignada recibe 403 con
  mensaje claro.
- La lista de responsables asignables (`assignees`): admin recibe todos los correos registrados;
  el editor solo el suyo (no filtra correos de otras cuentas).

## Anti-CSRF (Origin check)

`sameOriginOk()` compara el host del header `Origin` contra el `Host` de la petición (pasa si no
hay Origin — peticiones same-origin de navegadores viejos y server-to-server). Centralizado en los
gates ⇒ cubre todas las mutaciones sin repetir código. **Consecuencia para scripts/QA**: cualquier
POST/PATCH/DELETE externo debe mandar `Origin: https://ig-command-center-drab.vercel.app`.

## Headers (next.config.ts)

- **CSP**: `script-src`/`style-src` requieren `'unsafe-inline'` (hidratación/SSR de Next y el
  script anti-parpadeo de tema). **Sin `unsafe-eval`** → React en modo desarrollo se queja
  ("eval() is not supported"); es solo dev, en producción no aplica.
- `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS (sin `includeSubDomains` porque vive en subdominio vercel.app).

## Contraseñas

- Política (`passwordProblem`): mínimo 12 caracteres, ≥3 clases, y verificación
  **k-anonymity contra Have I Been Pwned** (SHA-1 prefix + Add-Padding, timeout 3.5s,
  **fail-open** si HIBP no responde).
- Cambio in-app (`/api/password`): re-autentica con la contraseña actual usando un cliente
  supabase-js separado (sin tocar cookies), rate limit 5/15min por IP.
- Olvido: flujo de email de Supabase → `/reset` (requiere configurar Site URL y Redirect URLs en
  Supabase Auth).

## Rutas públicas (sin sesión)

`proxy.ts` deja pasar sin cookie de sesión: `/login`, `/reset`, `/api/*`, y las páginas legales
`/privacidad` y `/eliminar-datos`. Estas dos últimas DEBEN seguir siendo públicas e indexables:
Meta exige que la política de privacidad y las instrucciones de eliminación de datos sean
accesibles sin login y para sus rastreadores (se registran en el panel de la app de Meta). Su
contenido vive en `src/app/privacidad/page.tsx` y `src/app/eliminar-datos/page.tsx`; el correo de
contacto está como constante `CONTACT` en cada una.
- Generador de contraseñas (`password-gen.ts`): CSPRNG, 16 chars, una de cada clase garantizada,
  sin ambiguos (l/o/I/O/0/1), shuffle Fisher-Yates seguro. Botón de dado al crear accesos.

## Rate limiting

`rateLimited(key, max, windowMs)` — buckets **en memoria** por IP+clave. ⚠️ Limitación conocida:
no se comparte entre instancias serverless de Vercel; es mitigación, no garantía. Si la app
fusionada necesita rate limiting duro, mover a un store compartido (Upstash/Redis).

## Cifrado de tokens

AES-256-GCM (`lib/crypto.ts`) con `TOKEN_ENC_KEY` (32 bytes hex). Cada token guarda
`enc + iv + tag`. Los tipos públicos (`PublicConnection`) excluyen el material de token; revisar
eso si se agregan campos.

## Cron

`/api/cron/sync` exige `Authorization: Bearer ${CRON_SECRET}` comparado con
`crypto.timingSafeEqual` (no `===`, para no filtrar por timing).

## Qué NO hacer

- No crear endpoints que muten sin pasar por `adminGate`/`accountGate`.
- No devolver `AccountConnection` crudo al navegador (usar `toPublicConnection`).
- No loggear tokens ni contraseñas.
- No agregar `unsafe-eval` al CSP para "arreglar" el warning de desarrollo.
- No aflojar el aislamiento por cuenta del editor "por conveniencia" de una vista.
