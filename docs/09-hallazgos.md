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

## Deuda conocida (no bugs, decisiones)

- El drag & drop sigue siendo solo de escritorio; en touch se usan ◀ ▶ (suficiente y estándar).
- `90vh` → `100dvh` aplicado al modal en móvil (la barra de URL de iOS tapaba los botones con vh).
- Rate limiting en memoria (documentado en 05); App Review de Meta pendiente (04/07).

## Protocolo para futuras auditorías

1. Buscar evidencia primero (archivo:línea, medición, captura); si no se puede demostrar, no se
   reporta.
2. Reproducir en producción cuando sea posible (Playwright 390px para móvil).
3. Corregir + actualizar el doc correspondiente en el mismo commit + dejar el hallazgo aquí.
