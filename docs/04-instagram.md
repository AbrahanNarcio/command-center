# 04 · Integración con Instagram (Meta)

Producto de Meta usado: **"Instagram API with Instagram Login"** (NO la vieja Basic Display, NO la
que requiere página de Facebook). Solo cuentas Business/Creator. Cliente HTTP propio en
[`src/lib/instagram.ts`](../src/lib/instagram.ts); transformación de datos en
[`src/lib/sync.ts`](../src/lib/sync.ts).

## Flujo OAuth

1. `GET /api/connect/[accountId]/start` (accountGate) → redirige a
   `www.instagram.com/oauth/authorize` con `state` **firmado** (HMAC) que amarra la cuenta.
2. Meta redirige a `IG_REDIRECT_URI` = `/api/connect/callback` con `?code&state`.
3. El callback valida el `state`, cambia code→token corto→**token de larga duración (60 días)**,
   obtiene el perfil (`username`, `name`, `account_type`, foto), **cifra el token**
   (AES-256-GCM, `lib/crypto.ts`) y hace upsert en `connections`.
4. Redirige a la app con `?igconnected=usuario` (el Dashboard muestra toast y va a Conexión IG).
5. Auto-fill: `name` y `handle` de la cuenta se actualizan con el perfil real (y en cada sync).

El token se **refresca** antes de expirar durante el sync (endpoint `refresh_access_token`).

## El sync (lib/sync.ts)

`syncAccount(accountId, {force})` — llamado por el botón "Sincronizar ahora"
(`POST /api/connect/[id]/sync?force=1`) y por el cron diario. Con `force` omite el throttle
(sin force, si `last_sync_at` es reciente responde `throttled`).

Qué construye (todo dentro de `metrics.data`):

- **KPIs por rango** (`kpiRanges` 1/7/30 días): cada rango pide sus insights Y los del periodo
  anterior del mismo tamaño (`endDaysAgo` desplaza la ventana) para calcular el **delta** (`+12%`
  / `-8.3%`). La UI etiqueta explícitamente contra qué compara ("vs. los 7 días anteriores").
- **Serie diaria de seguidores** (`followersDaily`): merge acumulativo por fecha con lo ya
  guardado (Map por date, lo nuevo pisa, se recorta a 400 días).
- **Anomalías**: días con |neto| > mediana±6·MAD (mínimo 120) en los últimos 30, avisa los últimos 3.
- **Retención de reels**: promedio de `ig_reels_avg_watch_time` por reel, con **color por banda de
  segundos** (código obligatorio): 0-3s cyan `#7a8cff`, 3-8s verde `#80ffb5`, 8-15s amarillo
  `#feda75`, 15-30s naranja `#ffa14e`, 30s+ rojo `#ff5d51`.
- **Historias**: views, replies y navegación con breakdown para calcular % de término
  (`1 - tap_exit/views`).
- **Reporte mensual**: el día 1 (en `SYNC_TIMEZONE`) crea un snapshot en `reports` si no existe.

## ⚠️ Trampas de la API de Meta (descubiertas a prueba y error — NO re-aprender)

1. **`follower_count` con `period=day`** devuelve la serie diaria de seguidores **GANADOS**
   (no el total, no el neto), y solo ~30 días hacia atrás. Por eso la serie larga se acumula
   localmente sync a sync.
2. **`follows_and_unfollows`** (breakdown `follow_type`: FOLLOWER/NON_FOLLOWER) solo funciona
   **por ventana**, no como serie. Para obtener el bucket de UN día hay que pedir la ventana
   `[end_time - 60s, end_time + 60s]`: la API selecciona buckets cuyo `end_time` cae DENTRO de la
   ventana pedida — una ventana "exacta" de un día devuelve vacío. El sync hace una llamada por
   día en paralelo.
3. **`endDaysAgo`**: para los deltas se piden ventanas desplazadas hacia atrás (verificado hasta
   60 días). Los insights de perfil aceptan `since/until` en epoch.
4. **Las URLs de miniaturas y fotos de perfil de Meta caducan** — se renuevan en cada sync; no
   cachearlas fuera de `metrics`.
5. **Versión de la API**: variable `IG_API_VERSION` (hoy v21.0). Meta la rota; si algo 400ea sin
   razón, revisar la versión primero.
6. **Scopes**: pedir solo `instagram_business_basic` (+los que de verdad se usen). Pedir de más
   hace que Meta rechace la app en revisión.
7. **Testers**: mientras la app de Meta está en modo desarrollo, cada cuenta a conectar debe ser
   **invitada como tester de Instagram** (App Roles) y aceptar la invitación en Instagram
   (Configuración → Sitios web y apps). El error "Insufficient Developer Role" al conectar = falta
   esa invitación. Para conectar clientes sin invitación se necesita pasar **App Review** (Fase 4,
   pendiente).

## Mensajería (bandeja de DMs)

Docs de Meta verificadas 2026-07-12 (endpoints en `lib/instagram.ts`):

- **Scope**: `instagram_business_manage_messages` (+ basic). Las conexiones hechas ANTES de
  agregar el scope no lo tienen: hay que desconectar y reconectar la cuenta.
- **Enviar**: `POST {graph}/{ver}/{IG_ID}/messages` con `{recipient:{id:IGSID}, message:{text}}` y
  `Authorization: Bearer`. **Ventana de 24h**: solo se puede responder dentro de las 24 horas
  posteriores al último mensaje del usuario; fuera de ella Meta devuelve error (la ruta reply lo
  traduce a un mensaje claro).
- **Backfill**: `GET /me/conversations?platform=instagram` y luego
  `GET /{CONV_ID}?fields=messages{id,created_time,from,to,message}`. ⚠️ Meta solo expone ~20
  mensajes recientes por conversación y omite conversaciones de "Solicitudes" inactivas +30 días.
  El histórico real lo acumula el webhook en nuestra base.
- **Webhooks**: dos pasos. (1) En el panel de Meta: producto Instagram → Webhooks → Callback URL
  `https://<dominio>/api/webhooks/instagram` + verify token (`IG_WEBHOOK_VERIFY_TOKEN`) y
  suscribir el campo `messages`. (2) POR CUENTA: `POST /me/subscribed_apps?subscribed_fields=messages`
  con el token de la cuenta (lo hace `/api/messages/sync`). Sin el paso 2 no llegan eventos.
- **Payload del webhook**: `entry[].id` = IG user id de la cuenta profesional;
  `entry[].messaging[]` con `sender.id`, `recipient.id`, `timestamp`, `message.{mid,text,is_echo}`.
  `is_echo` = lo envió la propia cuenta (p. ej. desde la app de IG): se guarda como `from_me`.
- En modo desarrollo (acceso estándar) los webhooks y la mensajería funcionan SOLO para cuentas
  con rol en la app (testers) — igual que el resto de la plataforma.

## Cron

`vercel.json` → `GET /api/cron/sync` todos los días a las **13:00 UTC**. Autenticación: header
`Authorization: Bearer ${CRON_SECRET}` comparado con `crypto.timingSafeEqual`. Recorre todas las
conexiones, sincroniza cada una (sin force) y dispara el reporte mensual si es día 1 en
`SYNC_TIMEZONE`.

## Modo sin credenciales

Si faltan las variables `IG_*`, `igConfigured=false`: la vista Conexión IG muestra "OFFLINE MOCK"
y la app trabaja con datos de ejemplo (`lib/seed.ts`) + edición manual de métricas
(`MetricsEditor`). Nada truena.
