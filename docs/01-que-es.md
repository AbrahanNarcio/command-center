# 01 · Qué es Content OS

## El producto en una frase

Un **command center multi-cuenta de Instagram** para una operación de contenido que maneja su
propia cuenta y las de sus clientes: centraliza métricas reales (API oficial de Meta), la
planeación y producción de contenido, y la relación con el cliente (accesos de solo lectura,
reportes, vistas simplificadas).

## Los tres públicos

1. **Admin (el dueño de la operación)** — ve y opera todas las cuentas.
2. **Editor (miembro del equipo o cliente que se autogestiona)** — opera TODO pero de una sola
   cuenta: crea piezas, conecta su Instagram, edita métricas, genera reportes. El aislamiento por
   cuenta es una regla dura del sistema.
3. **Cliente (viewer)** — solo lectura de su cuenta. Aterriza en el **Resumen** y solo ve las
   "Vistas para el cliente". La filosofía: que alguien de fuera entienda todo sin explicación.

## Mapa de vistas

El menú lateral está dividido en dos secciones con título:

### Vistas para el cliente (las ven todos los roles)

| Vista | ViewId | Qué hace |
| --- | --- | --- |
| Resumen | `summary` | Seguidores + frase real de crecimiento 30d, 3 KPIs en lenguaje llano (Vistas/Alcance/Interacción) con deltas, y "Qué se publica esta semana". Botones a Control y Planeación. **El cliente aterriza aquí; admin/editor aterrizan en Control.** |
| Planeación | `plan` | Qué se publica y qué día. Tira semanal (Lun-Dom, navegable, hoy resaltado) + tab de mes de solo lectura. Cada formato con icono y color. Los anuncios se representan como piezas formato `Ad` con fecha ("este día se sube o rota el anuncio"). |
| Control | `overview` | Dashboard técnico completo: 12 KPIs con deltas por rango (Hoy/7/30 días), evolución diaria real de seguidores (Totales/Ganados/Perdidos/Netos), mix de engagement (donut), alcance por formato, top publicaciones, retención de reels (caída por tramo + tiempo promedio por reel con código de segundos), heatmap de publicación, funnel a DM, historias, anomalías, piezas ganadoras, últimas publicaciones. |
| Reportes | `reports` | Snapshots congelados de métricas (histórico que el sync no pisa) con export a PDF vía print. Uno mensual se autogenera el día 1. |

### Administración (solo admin y editor)

| Vista | ViewId | Qué hace |
| --- | --- | --- |
| Pipeline | `pipeline` | Kanban por estado (Idea → Guion → Grabado → Editado → Aprobado → Programado), drag & drop, filtro por responsable. |
| Calendario | `calendar` | Piezas por semana (tablero Lun-Dom) o por mes (cuadrícula con fecha real; el "+" de cada celda crea una pieza ya fechada). |
| Generador | `generator` | Genera borradores de guion (hoy con un banco de hooks local, NO IA real todavía) y los envía al pipeline como pieza estructurada. |
| Fuentes | `sources` | Banco de materia prima por cuenta. Importa archivos de texto (.txt/.md/.csv/.srt/.vtt, máx ~500 KB); **guarda solo el texto, nunca el archivo**. |
| Conexión IG | `settings` | OAuth con Meta, sincronizar ahora, desconectar (con confirmación), crear/borrar accesos de clientes (con generador de contraseñas fuertes), panel de salud (admin). |

## La pieza de contenido (concepto central)

Una **pieza** es la unidad editorial. Tiene:

- **Guion estructurado en orden**: 1·Hook, 2·Problema, 3·Solución, 4·Prueba social (opcional), 5·CTA.
- **Ángulo** con código de color fijo: Problema=rojo, Solución=verde, Producto=azul, Mentalidad=amarillo.
- **Formato** con código de color fijo: Reel=cyan, Carrusel=amarillo, Historias=rosa, Ad=naranja.
- **Estado** del pipeline, **objetivo** (DM/Agenda/Registro/Venta/Tráfico a perfil), **responsable**
  (selector de usuarios registrados, NO texto libre; default = quien la crea), **hora**, **día** y
  **fecha** opcional (si hay fecha, el día se deriva de ella y se bloquea).
- **Score** de calidad (0-100) que alimenta el "quality gate" del hero.

## Invariantes (NO se negocian al modificar o fusionar)

1. **Español neutro en toda la interfaz.** Nada de jerga técnica de cara al cliente; el microcopy
   dice qué hace cada sección para el usuario (ver `06-ui.md`).
2. **Jamás fabricar datos.** Si una métrica no existe, se muestra "—" o un estado vacío honesto.
   Nada de porcentajes inventados, contadores falsos ni placeholders que parezcan datos.
3. **Solo API oficial de Meta.** Cero scraping, cero automatización que arriesgue baneos.
4. **Códigos de color estables** (ángulo, formato, bandas de retención por segundos). El mismo
   concepto tiene el mismo color en TODAS las vistas y en TODOS los temas (en claro se usan tonos
   más profundos del mismo color). Ver `06-ui.md`.
5. **Aislamiento por cuenta**: un editor/cliente nunca ve ni toca datos de otra cuenta. Se aplica
   en el servidor (gates), no solo en la UI.
6. **Estandarización entre cuentas**: lo que se muestra para la cuenta propia se muestra igual
   para las de clientes (deltas, rangos, layouts). La cuenta del dueño es el patrón.
7. **Los tokens de Instagram nunca salen del servidor** (ni al navegador, ni a git, ni a logs).
8. **Todo deploy es por push a `main`**; no hay deploys manuales.

## Qué NO es (todavía)

- No publica en Instagram (la "Fase 4" de publicación con aprobación manual está en backlog).
- El Generador no usa IA real todavía (banco de hooks local); integrar Claude API está en backlog.
- No hay app móvil; es una web responsive.
