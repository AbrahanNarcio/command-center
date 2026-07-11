# 03 · Modelo de datos

Fuente de verdad SQL: [`supabase/schema.sql`](../supabase/schema.sql) (se pega completo en el SQL
Editor de Supabase). Tipos TypeScript: [`src/lib/types.ts`](../src/lib/types.ts). Mappers
fila↔tipo: [`src/lib/db.ts`](../src/lib/db.ts).

## Tablas

### `accounts`
Cuenta de Instagram gestionada (propia o de cliente). `id` texto (`ac_...`), `name`, `handle`
(@usuario), `kind` (`propia`|`cliente`), `color` (acento de la cuenta en el rail). El nombre y el
handle se **auto-rellenan desde el perfil real de IG** al conectar y en cada sync.

### `pieces`
La pieza de contenido. Columnas planas: `format`, `status`, `owner` (email del responsable),
`day` (Lun..Dom), `"time"`, `objective`, `hook`, `summary`, `cta`, `score` + dos columnas
especiales:

- **`script` (jsonb)** — el guion: `{ angle, cuerpo }`. `hook` y `cta` viven como columnas propias
  por razones históricas; el cuerpo (desarrollo entre hook y CTA) va aquí. **Retrocompat:** piezas
  viejas guardaban `{ angle, problema, solucion, pruebaSocial }`; al leerlas, `toPiece` funde esos
  tres bloques en `cuerpo` (unidos por línea en blanco). Al guardar siempre se escribe el modelo
  nuevo `{ angle, cuerpo }`.
- **`date` (date, nullable)** — fecha real programada. **Semántica día/fecha**: si `date` existe,
  `day` SIEMPRE se deriva de ella (el server la recalcula en POST/PATCH con `dayFromDate`); sin
  `date`, la pieza vive solo en la vista semanal. `summary` se deriva del guion si queda vacío
  (primera línea del cuerpo > hook).

### `sources`
Materia prima por cuenta: `name`, `type`, `summary` (el TEXTO importado o pegado; nunca se
almacenan archivos), `tags` (jsonb array).

### `metrics`
**Una fila por cuenta**; `data` (jsonb) es el `AccountMetrics` completo menos
`accountId/updatedAt`. El sync la reescribe entera (con merges acumulativos en series). Claves
importantes dentro de `data`:

| Clave | Qué es |
| --- | --- |
| `kpis` | 12 KPIs del rango de 30 días (label/value/delta/detail/color) |
| `kpiRanges` | `{ "1": Kpi[], "7": Kpi[], "30": Kpi[] }` para el selector Hoy/7/30 — cada rango compara contra el periodo anterior del mismo tamaño |
| `followersDaily` | serie acumulada `{date, gained, lost}[]` (hasta 400 días; el sync la mergea por fecha, lo nuevo gana) |
| `followersTotal` | total de seguidores al último sync (reconstruye la serie de totales) |
| `anomalies` | días recientes con cambio de seguidores fuera de lo normal (mediana±6·MAD, umbral mínimo 120) |
| `reelsRetention` | por reel: tiempo promedio de visualización + thumb + permalink + **color por banda de segundos** |
| `retention` | caída por tramo (0-3s/3-8s/8-15s/15-30s/30s+) |
| `stories` | historias activas: vistas, respuestas, salidas, % que la terminó |
| `recentPosts` | miniaturas reales del feed con likes/comentarios |
| `engagementMix`, `reachByFormat`, `funnel`, `heatmap`, `insights`, `topPosts` | el resto de tarjetas del Control |

⚠️ **Los colores dentro de `data` son hex guardados.** En render SIEMPRE se pasan por
`accentVar()` (`lib/utils.ts`) que los convierte a variables de tema. Si agregas una tarjeta
nueva que lea colores de `metrics`, usa `accentVar` o se verá mal en los temas claros.

### `connections`
La conexión OAuth por cuenta. Token de larga duración cifrado en 3 columnas
(`token_enc`, `token_iv`, `token_tag` — AES-256-GCM con `TOKEN_ENC_KEY`), `ig_user_id`,
`username`, `scopes`, `expires_at`, `last_sync_at`, `status` (`connected`|`error`|`expired`),
`error`. El tipo público `PublicConnection` **excluye todo material de token**; es lo único que
viaja al navegador.

### `profiles`
Perfil de cada usuario de Auth: `user_id` (FK a `auth.users`), `email`, `role`
(`admin`|`editor`|`client`), `account_id` (cuenta asignada; null solo para admin). ⚠️ `client`
es el nombre histórico del rol de solo lectura; la UI lo llama "cliente"/"viewer".

### `reports`
Snapshots congelados: `title`, `note`, `data` (el `AccountMetrics` completo en el momento),
`created_at`. El cron genera uno mensual el día 1 (dedupe por título:
`Reporte mensual {handle} · {mes anterior}`).

Dentro de `data` viaja `reportMeta` (tipo `ReportMeta` en types.ts): `period`/`periodLabel`
(periodo elegido al generar; los KPIs del snapshot ya son los de ese rango y `growth`/`growthNet`
van recortados a esos días) y `sections` (qué secciones se incluyeron; la vista solo renderiza
esas). Va dentro del jsonb a propósito: no requiere migración y sobrevive al restore del deshacer.
Reportes viejos sin `reportMeta` = snapshot completo con todas las secciones.

## Reglas transversales de la capa de datos

- **RLS activado sin políticas** en todas las tablas: nadie lee nada con la anon key; el único
  camino es el server con service role.
- **Borrar una cuenta cascadea**: piezas, fuentes, métricas, conexión, reportes y además borra los
  usuarios auth de los clientes ligados (`deleteClientUsersOf`).
- **Red de seguridad de columnas opcionales** (`withOptionalColumns` en `db.ts`): los
  insert/update de piezas reintentan quitando `script`/`date` si la base aún no tiene esa columna
  (bases creadas antes de la migración). La app no se rompe, solo no persiste ese campo.
- Ids: texto con prefijo (`ac_`, `pz_`, `sc_`, `rp_`) generados con `newId()`.

## Migraciones

No hay motor de migraciones: el `schema.sql` usa `create table if not exists` y las migraciones
puntuales van **comentadas dentro del mismo archivo** para correrlas a mano en el SQL Editor.
Historial (todas ya aplicadas en producción):

```sql
-- roles (agregó 'editor' al check)
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('admin','editor','client'));
-- guion estructurado
alter table pieces add column if not exists script jsonb not null default '{}';
-- calendario mensual
alter table pieces add column if not exists date date;
```

Si agregas una columna nueva: (1) súmala a `schema.sql` + deja la línea de migración comentada,
(2) considera cubrirla con `withOptionalColumns` si la app debe seguir funcionando sin ella,
(3) avisa que hay que correrla a mano (Supabase no permite DDL vía REST).
