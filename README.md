# Content OS — IG Performance Command Center

Centro de mando de contenido e Instagram, **multi-cuenta**. Un panel para operar la cuenta propia
y las de clientes: métricas reales de Instagram, planeación de contenido, pipeline editorial,
calendario, generador de guiones, reportes y conexión oficial a la API de Meta.

- **Producción**: https://ig-command-center-drab.vercel.app
- **Repo**: https://github.com/AbrahanNarcio/ig-command-center (push a `main` = deploy automático en Vercel)

> **¿Vas a trabajar sobre este código (humano o agente)?** Lee primero la carpeta [`docs/`](docs/):
> ahí está TODO — producto, arquitectura, datos, API de Instagram, seguridad, UI/temas, operaciones
> y la guía de fusión con otras aplicaciones. Empieza por [`docs/README.md`](docs/README.md).

## Qué hace

| Vista | Para quién | Qué resuelve |
| --- | --- | --- |
| **Resumen** | Cliente | Lo esencial de su cuenta en lenguaje llano (seguidores, vistas, alcance, interacción, qué se publica esta semana). El cliente aterriza aquí. |
| **Planeación** | Cliente + equipo | Qué se publica y qué día: reels, carruseles, historias y anuncios, en tira semanal o mes. Se entiende sin conocer el sistema. |
| **Control** | Equipo (y cliente como 2º nivel) | El dashboard técnico completo: KPIs con deltas, evolución diaria de seguidores, mix de engagement, retención por reel, heatmap, funnel, historias, anomalías. |
| **Reportes** | Cliente + equipo | Snapshots congelados de métricas con export a PDF. Uno mensual se genera solo. |
| **Pipeline** | Equipo | Tablero kanban del avance editorial (Idea → … → Programado), drag & drop. |
| **Calendario** | Equipo | Piezas por semana o por mes con fecha real. |
| **Generador** | Equipo | Borradores de guion estructurado (hook/problema/solución/prueba social/CTA) desde fuentes. |
| **Fuentes** | Equipo | Banco de materia prima (transcripciones, DMs, comentarios); importa archivos de texto. |
| **Conexión IG** | Equipo | OAuth oficial con Meta, sincronización, accesos de clientes, salud del sistema. |

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript — *ojo: versión con breaking changes, ver [AGENTS.md](AGENTS.md)*
- **Supabase** (Postgres + Auth) — datos y login con roles; RLS activado sin políticas (todo pasa por el server)
- **Instagram API with Instagram Login** (OAuth oficial de Meta) — sin scraping, sin riesgo de baneo
- **Vercel** (hosting + cron diario de sincronización) — plan gratuito

## Roles

- **admin** — todo, de todas las cuentas: métricas, piezas, conexiones, accesos, salud.
- **editor** — todo, pero **solo de su propia cuenta** (incluye conectar su Instagram).
- **client** (viewer) — solo lectura de su cuenta; ve únicamente las "Vistas para el cliente".

## Puesta en marcha

1. **Supabase** — ver [SUPABASE_SETUP.md](SUPABASE_SETUP.md): crear proyecto, correr
   `supabase/schema.sql` en el SQL Editor, y `npm run setup -- email password` para crear el admin.
2. **Instagram** — ver [INSTAGRAM_SETUP.md](INSTAGRAM_SETUP.md): crear la app en Meta y completar `IG_*`.
3. Copiar `.env.example` a `.env.local` y completar (la lista completa de variables está en
   [`docs/07-operaciones.md`](docs/07-operaciones.md)).
4. Local: `npm run dev -- -p 8900` (el redirect URI de Meta en local apunta al puerto 8900).

## Seguridad (resumen)

- Tokens de Instagram cifrados en reposo (AES-256-GCM); jamás llegan al navegador ni a git.
- Toda mutación pasa por gates de rol + verificación de Origin (CSRF) en el servidor.
- CSP, HSTS, rate limiting, contraseñas con verificación k-anonymity contra HIBP.
- Detalle completo en [`docs/05-seguridad-roles.md`](docs/05-seguridad-roles.md).

## Documentación

| Documento | Contenido |
| --- | --- |
| [`docs/README.md`](docs/README.md) | Índice y orden de lectura recomendado |
| [`docs/01-que-es.md`](docs/01-que-es.md) | Producto, roles, vistas e **invariantes que no se negocian** |
| [`docs/02-arquitectura.md`](docs/02-arquitectura.md) | Stack, mapa de archivos, flujo de datos, API interna |
| [`docs/03-datos.md`](docs/03-datos.md) | Esquema Postgres, tipos TS, migraciones, semántica de fechas |
| [`docs/04-instagram.md`](docs/04-instagram.md) | OAuth, sync, endpoints de Meta y sus trampas (crítico) |
| [`docs/05-seguridad-roles.md`](docs/05-seguridad-roles.md) | Roles, gates, hardening |
| [`docs/06-ui.md`](docs/06-ui.md) | Sistema de temas, códigos de color, lenguaje visual, microcopy |
| [`docs/07-operaciones.md`](docs/07-operaciones.md) | Deploy, cron, QA con Playwright, variables de entorno |
| [`docs/08-fusion.md`](docs/08-fusion.md) | **Guía para fusionar esta app con otra**: acoplamientos y puntos de extensión |
