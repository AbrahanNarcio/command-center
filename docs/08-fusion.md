# 08 · Guía de fusión con otra aplicación

Este documento existe porque Content OS se va a fusionar con otro sistema. Está escrito para el
agente/equipo que haga esa fusión: qué partes son portables, qué está acoplado a qué, y qué
invariantes deben sobrevivir a la fusión.

## Lo primero: lee los invariantes

Los 8 invariantes de [`01-que-es.md`](01-que-es.md) son innegociables. En especial:
español neutro, no fabricar datos, solo API oficial de Meta, códigos de color estables,
aislamiento por cuenta aplicado en servidor, y tokens que jamás salen del servidor.

## Mapa de acoplamiento (qué depende de qué)

```
types.ts ◄── todo lo demás (fuente de verdad de tipos y colores)
db.ts ◄── rutas API, sync           (única puerta a Postgres)
auth.ts + security.ts ◄── rutas API (gates; nada muta sin pasar por aquí)
store-context.tsx ◄── Dashboard y todas las vistas (estado global del cliente)
sync.ts ◄── instagram.ts + db.ts    (transforma IG crudo → AccountMetrics)
globals.css ◄── todos los componentes (variables de tema; sin CSS locales)
```

### Módulos PORTABLES (bajo acoplamiento, se pueden llevar casi tal cual)

- `lib/crypto.ts` — cifrado AES-256-GCM genérico.
- `lib/security.ts` — origin check, rate limit, política de contraseñas HIBP, timing-safe.
- `lib/password-gen.ts` — generador CSPRNG.
- `lib/busy.ts` + `TopLoader` + `SplashScreen` — sistema de estados de carga.
- `lib/plan.ts` + `FormatIcon.tsx` — semántica de semanas/fechas y formatos.
- `components/charts.tsx` — LineChart/Donut (solo dependen de tipos y CSS vars).
- `ConfirmModal`, `ModalPortal`, `ThemeSelector` — UI genérica.
- El **sistema de temas completo** (bloques `:root[data-theme=...]` + mecanismo `--tint`): es CSS
  puro; portarlo = copiar los bloques de variables y respetar las 5 reglas de contraste de
  `06-ui.md`.

### Módulos ACOPLADOS (fusionar con cuidado)

- `store-context.tsx` — asume el payload exacto de `/api/bootstrap` (`PublicDb`). Si la app
  fusionada tiene otro estado global, lo más simple es conservar este store para las vistas de
  Content OS y puentear a nivel de página.
- `sync.ts` — corazón del negocio; toca `instagram.ts`, `db.ts` y la ESTRUCTURA jsonb de
  `metrics.data`. Cambiarle la forma a `AccountMetrics` implica migrar los datos guardados o
  aceptar re-sync total.
- `Dashboard.tsx` + `Rail.tsx` — el shell (hero, navegación por `ViewId`, landing por rol).
  Integrar una vista nueva = agregar `ViewId`, entrada en `NAV_GROUPS` (con su sección
  cliente/administración) y el render en el switch del Dashboard.
- Las rutas `api/*` — dependen de los gates y de `db.ts`; portarlas requiere llevarse
  `auth.ts`/`security.ts`/`supabase/*` juntos.

## Identidad y sesión

- Auth es **Supabase Auth** con cookie `sb-<ref>-auth-token`; el perfil/rol vive en la tabla
  `profiles` (no en el JWT). Si la app destino usa otro auth, la pieza a reemplazar es
  `getSessionProfile()` en `lib/auth.ts` — todos los gates consumen esa única función, así que
  adaptar la fusión de identidad = reimplementar esa función y mantener el contrato
  `{ userId, email, role, accountId }`.
- El multi-tenant es **por cuenta de Instagram** (tabla `accounts`), no por organización. Si el
  sistema destino tiene "workspaces/orgs", el mapeo natural es: org → varias `accounts`.

## Base de datos

- 7 tablas (ver `03-datos.md`), ids de texto con prefijo, sin motor de migraciones (SQL manual).
- Lo más delicado es `metrics.data` (jsonb grande, forma documentada en `03-datos.md`): tratarlo
  como contrato. `connections` contiene secretos cifrados: NUNCA moverla/copiarla sin llevar
  también `TOKEN_ENC_KEY`, o todos los tokens quedan ilegibles (los usuarios tendrían que
  reconectar Instagram — aceptable como plan B, avisando).
- Borrado de cuenta cascadea a usuarios auth de clientes: revisar esa semántica si la fusión
  cambia el ciclo de vida de usuarios.

## Checklist de fusión sugerido

1. [ ] Decidir el sistema de identidad final; adaptar `getSessionProfile()` (contrato intacto).
2. [ ] Mapear tenancy: `accounts` ↔ el concepto equivalente del otro sistema.
3. [ ] Mover el esquema (schema.sql) o apuntar la app al Postgres destino; llevar
       `TOKEN_ENC_KEY` o planear reconexión de Instagram.
4. [ ] Conservar las rutas `api/connect/*` y `api/cron/sync` con sus env vars (Meta exige el
       redirect URI EXACTO — si cambia el dominio, actualizarlo en la app de Meta).
5. [ ] Integrar las vistas: o se monta el `<Dashboard/>` completo como módulo, o se portan vistas
       sueltas llevando store + tipos + CSS de temas.
6. [ ] Verificar los invariantes de `01-que-es.md` en el resultado (en especial roles/aislamiento
       con un usuario de cada rol) y las reglas de contraste de `06-ui.md` en los 4 temas.
7. [ ] Correr el flujo E2E de QA de `07-operaciones.md` (login por cookie + Playwright) contra el
       entorno fusionado.

## Dónde está el conocimiento no obvio

- Trampas de la API de Meta: `04-instagram.md` (ventanas de ±60s, serie de "ganados", URLs que
  caducan, testers). **Costó días descubrirlas; no las re-descubras.**
- Reglas de contraste multi-tema: `06-ui.md`.
- Red de seguridad de columnas (`withOptionalColumns`): `03-datos.md`.
- Semántica fecha/día de las piezas: `03-datos.md` (el server SIEMPRE deriva `day` de `date`).
