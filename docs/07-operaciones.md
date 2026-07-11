# 07 · Operaciones

## Deploy

- **Vercel**, auto-deploy en cada push a `main` del repo
  `github.com/AbrahanNarcio/ig-command-center`. No hay staging: main = producción.
- URL de producción: `https://ig-command-center-drab.vercel.app`.
- Antes de pushear: `npm run build` local (y `npx tsc --noEmit` si hubo cambios de tipos).
- El estado del deploy se puede consultar por la API de Vercel
  (`/v6/deployments?projectId=...`) esperando `READY` + el SHA del commit.

## Variables de entorno (todas las que el código lee)

| Variable | Dónde | Qué es |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | cliente+server | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente+server | anon key (no lee datos por RLS; solo auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server** | service role — el único con acceso a datos |
| `IG_APP_ID` / `IG_APP_SECRET` | server | app de Meta (producto Instagram) |
| `IG_REDIRECT_URI` | server | EXACTA a la registrada en Meta (local: `http://localhost:8900/api/connect/callback`) |
| `IG_API_VERSION` | server | versión Graph API (hoy v21.0) |
| `IG_SCOPES` | server | `instagram_business_basic` (+extras solo si se usan) |
| `TOKEN_ENC_KEY` | server | 32 bytes hex (`openssl rand -hex 32`) para AES-256-GCM |
| `CRON_SECRET` | server | bearer del cron de Vercel |
| `SYNC_TIMEZONE` | server | zona horaria para "día 1" del reporte mensual |
| `ANTHROPIC_API_KEY` | **server** | key de la API de Claude para el Generador (sin ella el generador responde 503) |
| `ANTHROPIC_MODEL` | server | opcional; modelo para generar guiones (default `claude-sonnet-5`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | solo `npm run setup` | crear el admin inicial |

`.env.example` documenta cada una; `.env.local` jamás se commitea.

## Cron

`vercel.json`: `GET /api/cron/sync` diario a las **13:00 UTC**. Hace sync de todas las conexiones
y genera el reporte mensual el día 1 (`SYNC_TIMEZONE`). Plan Hobby de Vercel limita la cantidad de
crons — por eso todo va en uno.

## Scripts

- `npm run dev -- -p 8900` — dev local (puerto 8900 por el redirect de Meta).
- `npm run build` / `npm start` — producción.
- `npm run setup -- email password` — bootstrap del admin + cuenta demo (usa service role).

## Migraciones SQL

Manuales, en el SQL Editor de Supabase (la REST API no permite DDL). Las líneas viven comentadas
en `supabase/schema.sql`. Ver `03-datos.md` para el historial y el protocolo.

## QA / verificación en producción

No hay suite de tests. La verificación es E2E contra producción (o dev local) con
**playwright-core** apuntando a Brave. Receta que funciona:

```js
// 1. Login por la API de Supabase para fabricar la cookie de sesión:
const login = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: ANON_KEY },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json());
const cookieVal = "base64-" + Buffer.from(JSON.stringify(login)).toString("base64url");
// nombre de cookie: sb-<project-ref>-auth-token   (expira ~1h; re-login ante 401)

// 2. Playwright con Brave:
const browser = await chromium.launch({
  executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  headless: true,
});
const ctx = await browser.newContext();
await ctx.addCookies([{ name: "sb-...-auth-token", value: cookieVal, domain: HOST, path: "/" }]);
```

Para probar mutaciones vía fetch directo, **incluir header `Origin`** con la URL de la app (el
check anti-CSRF lo exige). Las capturas de QA se guardan en `qa-screenshots/` (no es parte de la
app; es evidencia de verificación).

Gotchas de QA conocidos:

- El overlay de dev de Next marca "1 Issue": es React dev pidiendo `eval()` que el CSP bloquea.
  Solo en desarrollo; ignorar.
- Selectores: cuando un texto se repite en dos grupos de chips, scopear con el `aria-label` del
  grupo (strict mode de Playwright).
- KPI/labels/colores viven DENTRO de `metrics.data` guardado: si cambias cómo el sync los
  construye, hay que re-sincronizar (`POST /api/connect/{id}/sync?force=1`) para verlos.

## Pendientes operativos conocidos

- **App Review de Meta** (Fase 4): hoy solo conectan cuentas invitadas como testers.
- Publicación en IG con aprobación manual: backlog.
- ~~Generador con IA real (Claude API)~~: hecho (2026-07-11). Requiere `ANTHROPIC_API_KEY` en
  Vercel; opcional `ANTHROPIC_MODEL` (default `claude-sonnet-5`).
- Rate limiting en memoria (no compartido entre instancias): suficiente por ahora, ver
  `05-seguridad-roles.md`.
