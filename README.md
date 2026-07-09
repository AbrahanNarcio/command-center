# IG Performance Command Center

Centro de mando de contenido e Instagram, multi-cuenta. Un panel para operar la cuenta propia
y las de clientes: métricas, pipeline editorial, calendario, generador de piezas y conexión
oficial a Instagram.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Supabase** (Postgres + Auth) — datos y login con roles
- **Instagram API con Instagram Login** (OAuth oficial de Meta) — sin scraping
- Desplegado en **Vercel** (auto-deploy por push a `main`)

## Roles

- **admin**: edita todo, ve todas las cuentas, conecta Instagram, crea accesos de clientes.
- **client**: entra con su login y ve solo su cuenta, en modo lectura.

## Puesta en marcha

1. **Supabase** — ver [SUPABASE_SETUP.md](SUPABASE_SETUP.md): crear proyecto, correr
   `supabase/schema.sql`, y `npm run setup -- email password` para crear el admin + la cuenta demo.
2. **Instagram** — ver [INSTAGRAM_SETUP.md](INSTAGRAM_SETUP.md): crear la app en Meta y completar
   las variables `IG_*`.
3. Variables de entorno: copiar `.env.example` a `.env.local` y completar.
4. Local: `npm run dev` (o `PORT=8900 npm run dev`).

## Seguridad

- Los tokens de Instagram se guardan cifrados (AES-256-GCM) y nunca se envían al navegador.
- Todo el acceso a datos pasa por el servidor con el service role de Supabase (RLS activado).
- Cuentas Business/Creator únicamente; sin publicación automática.
