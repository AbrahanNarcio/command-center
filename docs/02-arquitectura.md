# 02 · Arquitectura

## Stack y decisiones

- **Next.js 16 App Router** — ⚠️ versión con breaking changes respecto al conocimiento común:
  los `params` de rutas son **Promises** (`const { id } = await params`), el middleware se llama
  **`src/proxy.ts`** (no `middleware.ts`). Ante cualquier duda de framework, leer
  `node_modules/next/dist/docs/` (regla de [AGENTS.md](../AGENTS.md)).
- **React 19**, TypeScript estricto, CSS plano en un solo `globals.css` (sin Tailwind, sin
  CSS-in-JS). Los estilos se organizan por secciones comentadas.
- **Supabase** como Postgres + Auth. **RLS está activado en todas las tablas SIN políticas**: la
  anon key no puede leer nada; todo acceso a datos pasa por el servidor Next con el service role.
- **Vercel** con cron diario. Plan Hobby: máximo de crons limitado, por eso el reporte mensual
  corre DENTRO del cron diario (no como cron aparte).

## Mapa de archivos anotado

```
src/
├── proxy.ts                  # "Middleware" Next 16: protege rutas, /login y /reset públicas
├── app/
│   ├── layout.tsx            # <html> + script anti-parpadeo de tema (lee localStorage antes de pintar)
│   ├── page.tsx              # monta <StoreProvider><Dashboard/></StoreProvider>
│   ├── login/page.tsx        # login + "¿la olvidaste?" (flujo de reset por email)
│   ├── reset/page.tsx        # establecer contraseña nueva desde el link del email
│   ├── icon.svg              # favicon (cuadrado degradado IG + pulso blanco)
│   ├── globals.css           # TODO el CSS: variables de tema, componentes, vistas, responsive
│   └── api/                  # rutas server (ver tabla de API abajo)
├── components/
│   ├── Dashboard.tsx         # shell: hero, filtros globales, switch de vistas, toast, landing por rol
│   ├── Rail.tsx              # menú lateral: cuentas, NAV_GROUPS (cliente/administración), mini-card
│   ├── charts.tsx            # LineChart (SVG + tooltip) y Donut (segmentos con hover)
│   ├── PieceModal.tsx        # ficha de contenido: ángulo, guion 1-5, metadatos, fecha→día
│   ├── PostCard.tsx          # tarjeta de pieza (badges formato/ángulo/estado, score, acciones)
│   ├── FormatIcon.tsx        # FORMAT_META: icono+color+frase llana por formato (compartido)
│   ├── AccountModal.tsx      # crear/editar cuenta (doble clic en el rail para editar)
│   ├── ConfirmModal.tsx      # confirmación genérica (danger = rojo) con estado ocupado
│   ├── PasswordModal.tsx     # cambio de contraseña in-app (reauth + política)
│   ├── MetricsEditor.tsx     # edición manual de KPIs (fallback sin conexión IG)
│   ├── SplashScreen.tsx      # carga inicial: logo + anillo IG girando + etapa real
│   ├── TopLoader.tsx         # barra superior de progreso (suscrita al bus de src/lib/busy.ts)
│   ├── ThemeSelector.tsx     # 4 temas (oscuro/claro/glass/aero), persiste en localStorage
│   ├── ModalPortal.tsx       # portal a <body> para modales
│   ├── KpiIcon.tsx           # icono decorativo por etiqueta de KPI
│   └── views/                # una vista por archivo (Summary, Plan, Overview, Pipeline,
│                             #  Calendar, Reports, Generator, Sources, Settings)
└── lib/
    ├── types.ts              # TODOS los tipos de dominio + constantes de color (fuente de verdad)
    ├── views.ts              # ViewId (ids de las vistas)
    ├── store-context.tsx     # estado global del cliente: carga bootstrap, mutaciones, toast+deshacer
    ├── db.ts                 # capa de datos: mappers fila↔tipo, CRUD, red de seguridad de columnas
    ├── auth.ts               # sesión + roles + gates (adminGate/accountGate con check de Origin)
    ├── security.ts           # sameOriginOk, rate limiting, política de contraseñas (HIBP), timing-safe
    ├── crypto.ts             # AES-256-GCM para tokens de Instagram
    ├── instagram.ts          # cliente de la Graph API (perfil, insights, media, historias)
    ├── sync.ts               # EL CORAZÓN: convierte datos crudos de IG en AccountMetrics
    ├── plan.ts               # helpers de semana/fecha para Planeación y Resumen
    ├── seed.ts               # datos demo + newId()
    ├── utils.ts              # accentVar (hex→variable de tema), scoreColor, relativeTime, PALETTE
    ├── password-gen.ts       # generador CSPRNG de contraseñas fuertes
    ├── busy.ts               # bus global de "hay peticiones en curso" (alimenta TopLoader)
    └── supabase/             # clientes: admin (service role), server (SSR cookies), browser
```

## Flujo de datos

```
┌─ navegador ──────────────────────────────────────────────────────┐
│ StoreProvider (store-context.tsx)                                │
│   └─ GET /api/bootstrap  ──────────────►  payload PublicDb       │
│        accounts, pieces, sources, metrics, connections(públicas),│
│        me{email,role}, clientUsers, assignees, igConfigured      │
│   └─ mutaciones: fetch a /api/* → actualización optimista/local  │
│      del estado + toast (con "Restablecer" en los deletes)       │
└──────────────────────────────────────────────────────────────────┘
            ▲ cookies de sesión Supabase (sb-*-auth-token)
┌─ servidor ───────────────────────────────────────────────────────┐
│ api/* → gate (rol + Origin) → lib/db.ts (service role) → Postgres│
│ api/connect/* → OAuth Meta → tokens cifrados → lib/sync.ts       │
│ api/cron/sync → recorre conexiones → sync + reporte mensual      │
└──────────────────────────────────────────────────────────────────┘
```

Puntos clave del store (`store-context.tsx`):

- Una sola carga (`/api/bootstrap`) alimenta toda la app; `refresh()` la repite sin resetear la
  cuenta activa. El splash muestra las etapas reales de esa carga.
- Cada mutación pasa por `api()` que envuelve el fetch con `trackBusy()` → la barra superior corre
  mientras haya peticiones vivas.
- Los deletes guardan la fila borrada y ofrecen **Restablecer** en el toast: el restore reinserta
  con el MISMO id (los POST aceptan `body.id` / `body.restore` para eso).
- `activeId` = cuenta seleccionada en el rail; los derivados `accountPieces`, `accountSources`,
  `activeMetrics`, `activeConnection` filtran por ella.

## API interna (rutas y quién puede llamarlas)

| Ruta | Métodos | Gate |
| --- | --- | --- |
| `/api/bootstrap` | GET | sesión (admin ve todo; editor/cliente solo su cuenta) |
| `/api/accounts` · `/api/accounts/[id]` | POST · PATCH, DELETE | admin |
| `/api/pieces` · `/api/pieces/[id]` | POST · PATCH, DELETE | accountGate (admin o editor de ESA cuenta) |
| `/api/sources` · `/api/sources/[id]` | POST · PATCH, DELETE | accountGate |
| `/api/metrics/[accountId]` | PUT | accountGate |
| `/api/reports` · `/api/reports/[id]` | GET, POST · DELETE | GET sesión de la cuenta · POST generar accountMemberGate (cualquier usuario de SU cuenta, incluido viewer; acepta `period` "7"/"30" y `sections`) · restore/DELETE accountGate |
| `/api/generate` | POST | accountGate + rate limit 10/10min → Claude API server-side (guion hook/cuerpo/CTA; valida que la fuente sea de la cuenta; 503 sin `ANTHROPIC_API_KEY`) |
| `/api/messages` | GET | equipo de la cuenta (admin con `?account=`; editor la suya; viewer 403) |
| `/api/messages/[id]` · `/reply` | GET, PATCH · POST | accountGate vía `rowAccountId("ig_conversations")` (hilo, etiquetas/nota, responder) |
| `/api/messages/sync` | POST | accountGate → backfill de conversaciones + suscripción a webhooks (`/me/subscribed_apps`) |
| `/api/webhooks/instagram` | GET, POST | GET verificación de Meta (verify token) · POST firmado con `X-Hub-Signature-256` (HMAC del app secret, timing-safe); sin sesión |
| `/api/clients` · `/api/clients/[userId]` | POST · DELETE | admin (crear/borrar accesos) |
| `/api/password` | POST | sesión + reauth con contraseña actual + rate limit |
| `/api/connect/[accountId]/start` | GET | accountGate → redirige a Meta |
| `/api/connect/callback` | GET | valida `state` firmado → guarda conexión cifrada |
| `/api/connect/[accountId]/sync` | POST (`?force=1`) | accountGate → corre lib/sync |
| `/api/connect/[accountId]` | DELETE | accountGate (desconectar) |
| `/api/cron/sync` | GET | header con `CRON_SECRET` (comparación timing-safe) |

Los PATCH/DELETE de piezas/fuentes/reportes resuelven la cuenta dueña de la fila con
`rowAccountId(tabla, id)` antes de aplicar el gate (nunca confían en el body).

## Convenciones de código

- Comentarios en español, breves, solo donde el código no puede decirlo.
- Los tipos de dominio viven en `lib/types.ts`; los componentes no definen tipos de datos propios.
- CSS: variables de tema en `:root` / `:root[data-theme="..."]`; los colores de datos siempre via
  variable o `accentVar()` (ver `06-ui.md`).
- Estados de carga: botón con spinner (`.spin`) + barra superior; los guardados de modal esperan
  (`await`) antes de cerrar.
