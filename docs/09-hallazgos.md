# 09 · Hallazgos de la auditoría de bugs (2026-07-11)

Registro de los bugs REALES encontrados en la auditoría, cada uno con su evidencia verificable
(archivo:línea, medición o reproducción en producción) y su estado. Regla de la auditoría: cero
suposiciones — solo entra aquí lo comprobado.

## Corregidos en esta ronda

### 1. En iOS, enfocar cualquier campo hacía zoom involuntario
- **Evidencia:** los campos heredaban `font: inherit` (globals.css, reset de `input/select/textarea`)
  con fuentes de 13-14px. Safari iOS hace zoom automático al enfocar campos con fuente menor a
  16px (comportamiento documentado de la plataforma).
- **Fix:** en ≤760px todos los `input/select/textarea` van a `font-size: 16px`.

### 2. Imposible mover piezas del pipeline en pantallas táctiles
- **Evidencia:** el tablero usaba SOLO drag & drop de HTML5 (`draggable`/`onDragStart`/`onDrop`,
  PipelineView.tsx) — esos eventos no se disparan con touch. El único rodeo era abrir Editar y
  cambiar el Estado a mano.
- **Fix:** botones ◀ ▶ en cada tarjeta (PostCard `onMove`) que mueven la pieza al estado
  anterior/siguiente; con tooltip del estado destino y deshabilitados en los extremos. El drag
  sigue funcionando en escritorio.

### 3. Imposible editar cuentas en pantallas táctiles
- **Evidencia:** la edición de cuenta era SOLO `onDoubleClick` (Rail.tsx) — el doble clic no existe
  en touch, y además era un affordance invisible (nada indicaba que se podía).
- **Fix:** botón lápiz visible en cada fila de cuenta (solo admin). La fila pasó de `<button>` a
  `div[role=button]` (un botón anidado en otro botón es HTML inválido) conservando teclado
  (Enter/Espacio).

### 4. El generador arrastraba la fuente de OTRA cuenta al cambiar de cuenta
- **Evidencia:** GeneratorView guardaba el NOMBRE de la fuente en estado (`useState("")`) y nunca
  lo reseteaba al cambiar de cuenta; `chosenSource = source || accountSources[0]?.name` producía
  un valor que ni siquiera existía en el select de la cuenta nueva.
- **Fix:** la fuente se guarda por `sourceId` y un efecto la resetea (junto con el resultado) al
  cambiar `activeAccount.id`. El server además valida que la fuente pertenezca a la cuenta
  (`getSourceForAccount`).

### 5. Las piezas del generador caían siempre en "Lun"
- **Evidencia:** GeneratorView no enviaba `day` y POST `/api/pieces` tiene default `"Lun"`
  (route.ts: `day: date ? dayFromDate(date) : body.day || "Lun"`). Toda pieza generada aparecía el
  lunes en Planeación/Calendario aunque fuera sábado.
- **Fix:** el generador envía el día de HOY calculado en el navegador (hora local del usuario, no
  la del servidor).

### 6. El generador mostraba un "Score 90" inventado y guiones fingidos
- **Evidencia:** GeneratorView tenía 2 hooks hardcodeados por objetivo (`HOOK_BANK`), un cuerpo de
  3 frases fijas idénticas para todo, y `score = 70 + edge*5` presentado como badge "Score" — una
  métrica fabricada (viola el invariante de no fabricar datos). La fuente elegida no se usaba.
- **Fix:** generación real con la API de Claude (`/api/generate`): usa la materia prima de la
  fuente, el formato, el objetivo y el filo; el badge ahora muestra el ÁNGULO elegido por la IA;
  las piezas entran con score 70 neutro (el quality score lo decide el equipo, no una fórmula).

### (Ronda anterior, mismo día) Semana del calendario ignoraba fechas; fallos de guardado mudos; búsqueda sin cuerpo
Documentados y corregidos en la ronda anterior: ver commits `f387814`…`b2073a3` y `docs/06-ui.md`.

## Ronda 2 (2026-07-11, misma fecha)

### 7. `/api/generate` sin rate limit (riesgo de costo)
- **Evidencia:** `/api/clients` (10/10min) y `/api/password` (5/15min) usan `rateLimited`; la ruta
  nueva de IA — que cuesta dinero por llamada — no lo tenía.
- **Fix:** `rateLimited("generate", 10, 10*60_000)` tras el gate.

### 8. 404 y errores fatales salían en inglés
- **Evidencia:** no existían `src/app/not-found.tsx` ni `src/app/error.tsx`; Next muestra sus
  páginas por defecto en inglés ("This page could not be found"), rompiendo el invariante de
  español neutro.
- **Fix:** `not-found.tsx` y `error.tsx` propios, en español, con botón de regreso/reintento.

### 9. El drawer móvil no respondía a Escape ni gestionaba el foco
- **Evidencia:** cero manejadores de `keydown`/`focus` en Dashboard/Rail (grep vacío).
- **Fix:** Escape cierra el drawer; al abrir, el foco va a la X; al cerrar con Escape vuelve a la
  hamburguesa; `aria-expanded` en el botón de menú.

### 10. Una pestaña abierta mostraba datos viejos para siempre
- **Evidencia:** el bootstrap se cargaba UNA vez al montar (`useEffect` en store-context); el sync
  diario corre a las 13:00 UTC y la pestaña nunca se enteraba.
- **Fix:** al volver a la pestaña (`visibilitychange`), si pasaron >5 min desde la última carga,
  se refresca en silencio.

### 11. Imágenes de IG rotas si el sync falla unos días
- **Evidencia:** las URLs de imagen de Meta caducan (trampa documentada en `04-instagram.md`); los
  5 `<img>` del app (avatares en rail/hero/topbar, miniaturas de reels y publicaciones) no tenían
  `onError` → icono de imagen rota.
- **Fix:** helper `hideOnImgError` (utils.ts): oculta la imagen (y su anillo si es avatar).

### 12. El login no enlazaba la política de privacidad
- **Evidencia:** la página de login no tenía ningún enlace legal; Meta pide que la política sea
  accesible desde el diálogo de inicio de sesión ("Política de privacidad del cuadro de diálogo de
  inicio de sesión" en la configuración de la app).
- **Fix:** footer del login con enlaces a `/privacidad` y `/eliminar-datos`.

### Descartado con datos (no era problema)
- **Tamaño del bundle:** 215KB de JS transferidos (747KB descomprimidos) medidos en producción —
  razonable para un dashboard; no amerita code-splitting todavía.

## Deuda conocida (no bugs, decisiones)

- El drag & drop sigue siendo solo de escritorio; en touch se usan ◀ ▶ (suficiente y estándar).
- `90vh` → `100dvh` aplicado al modal en móvil (la barra de URL de iOS tapaba los botones con vh).
- Rate limiting en memoria (documentado en 05); App Review de Meta pendiente (04/07).

## Protocolo para futuras auditorías

1. Buscar evidencia primero (archivo:línea, medición, captura); si no se puede demostrar, no se
   reporta.
2. Reproducir en producción cuando sea posible (Playwright 390px para móvil).
3. Corregir + actualizar el doc correspondiente en el mismo commit + dejar el hallazgo aquí.
