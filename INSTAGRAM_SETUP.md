# Conectar Instagram — sin riesgo de baneo

Esta app usa **la API oficial de Meta** ("Instagram API with Instagram Login"). Es la vía autorizada:
no hace scraping, no automatiza DMs fríos, no usa cuentas personales y **nunca** expone tokens en el
navegador. El riesgo de baneo viene de esas prácticas prohibidas — aquí no se hace ninguna.

## 1. Crear la app en Meta

1. Entra a <https://developers.facebook.com/> → **Create App**.
2. Agrega el producto **Instagram** → **Business Login for Instagram** (Instagram API with Instagram Login).
3. En la configuración del login, registra la **Redirect URI** exacta:
   - Local: `http://localhost:8900/api/connect/callback`
   - Producción: `https://TU_DOMINIO/api/connect/callback`
4. Anota el **Instagram App ID** y el **Instagram App Secret**.

## 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Completa en `.env.local`:

| Variable | Qué es |
| --- | --- |
| `IG_APP_ID` / `IG_APP_SECRET` | Credenciales de la app de Meta |
| `IG_REDIRECT_URI` | La misma URI registrada arriba |
| `IG_SCOPES` | Empieza con `instagram_business_basic` (perfil + media + insights) |
| `TOKEN_ENC_KEY` | `openssl rand -hex 32` → cifra los tokens en reposo |

## 3. Requisitos de la cuenta (obligatorio)

- La cuenta de Instagram debe ser **Business** o **Creator** (no personal).
- Mientras la app esté en **modo desarrollo**, agrega tu cuenta como **tester** en el panel de Meta.

## 4. Conectar

1. Reinicia el servidor de desarrollo (`PORT=8900 npm run dev`) para tomar las variables.
2. En la app → pestaña **IG Ready** → **Conectar Instagram con OAuth**.
3. Aceptas permisos en la pantalla de Meta → vuelves a la app con la cuenta conectada.
4. **Sincronizar ahora** trae reach, views, interacciones, likes, comentarios, saves y shares reales.

## 5. Para producción

- Pasa el **App Review** de Meta para los permisos que uses, antes de conectar cuentas de clientes reales.
- La publicación de contenido queda detrás de aprobación humana (sin publicación automática).
- El sync tiene throttle (30 min) y refresca el token de larga duración automáticamente.

## Cómo se guardan los tokens

El token de larga duración (~60 días) se cifra con **AES-256-GCM** (`src/lib/crypto.ts`) y se guarda en el
servidor. El endpoint `/api/bootstrap` envía al navegador una vista pública de la conexión **sin** material
de token. Ver `src/lib/instagram.ts` para los endpoints exactos (verificados contra la doc de Meta).
