# Supabase — base de datos + login (gratis)

La plataforma ahora es multi-usuario: tú (admin) editas todo; cada cliente entra con su login y **solo
ve** su dashboard. Los datos viven en Supabase (Postgres gratis).

## 1. Crear el proyecto (una vez, ~3 minutos)

1. Entra a <https://supabase.com> → **Start your project** → crea una cuenta (con GitHub o email).
2. **New project**: elige un nombre (ej. `ig-command-center`), una contraseña de base de datos
   (guárdala en tu gestor), y la región más cercana (ej. `East US`). Plan **Free**.
3. Espera ~1 minuto a que el proyecto quede listo.

## 2. Copiar las credenciales

En el dashboard del proyecto → ⚙️ **Project Settings** → **API**:

| Copia | Pégalo en `.env.local` como |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key (Reveal) | `SUPABASE_SERVICE_ROLE_KEY` |

> La `service_role` es secreta: solo va en `.env.local` (y en las variables de entorno del hosting), jamás al navegador.

## 3. Crear las tablas

Dashboard → **SQL Editor** → **New query** → pega TODO el contenido de
[`supabase/schema.sql`](supabase/schema.sql) → **Run**. Debe decir "Success".

## 4. Crear tu usuario admin + cuenta demo

```bash
npm run setup -- tu@email.com TuContraseñaSegura
```

Esto crea: tu login de **admin**, tu cuenta propia (vacía, lista para el sync de Instagram) y una
**cuenta demo** con datos de ejemplo para mostrar la plataforma.

## 5. Probar

```bash
PORT=8900 npm run dev
```

Abre la app → te redirige a `/login` → entra con tu email y contraseña → dashboard completo.

## Crear el acceso de un cliente

Pestaña **IG Ready** → panel **"Acceso de clientes"** (con la cuenta del cliente seleccionada en la
barra lateral) → email + contraseña → **Crear acceso**. Le pasas esas credenciales al cliente; cuando
entre verá únicamente su cuenta, en modo solo lectura.
