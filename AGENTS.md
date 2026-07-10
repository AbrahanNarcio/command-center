<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Documentación del proyecto

Antes de modificar cualquier cosa, lee la carpeta **`docs/`** (empieza por `docs/README.md`):
contiene producto, arquitectura, modelo de datos, integración con Instagram (con sus trampas),
seguridad/roles, sistema de temas/UI, operaciones y la guía de fusión. En especial:

- **Invariantes innegociables**: `docs/01-que-es.md` (español neutro, no fabricar datos, solo API
  oficial de Meta, códigos de color estables, aislamiento por cuenta en servidor, tokens jamás al
  navegador).
- Si cambias comportamiento (vistas, tablas, endpoints, reglas visuales), **actualiza el doc
  correspondiente en `docs/` en el mismo commit**.
