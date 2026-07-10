# Documentación de Content OS

Esta carpeta contiene todo lo necesario para que una persona **o un agente de IA** entienda la
aplicación sin haber participado en su construcción: qué hace, por qué está construida así, dónde
vive cada cosa y qué reglas no se deben romper al modificarla o fusionarla con otro sistema.

## Orden de lectura recomendado

1. **[01-que-es.md](01-que-es.md)** — El producto: vistas, roles, decisiones de diseño e
   **invariantes** (léelas antes de tocar nada).
2. **[02-arquitectura.md](02-arquitectura.md)** — Cómo está construida: mapa de archivos anotado,
   flujo de datos, API interna.
3. **[03-datos.md](03-datos.md)** — El modelo de datos: tablas, tipos, migraciones, semántica de
   fecha/día y del guion estructurado.
4. **[04-instagram.md](04-instagram.md)** — La integración con Meta: OAuth, sincronización y las
   trampas de la API que costó descubrir (no las re-aprendas por las malas).
5. **[05-seguridad-roles.md](05-seguridad-roles.md)** — Roles, gates y hardening.
6. **[06-ui.md](06-ui.md)** — Sistema de temas, códigos de color obligatorios, lenguaje visual de
   botones y reglas de microcopy.
7. **[07-operaciones.md](07-operaciones.md)** — Deploy, cron, variables de entorno, QA con
   Playwright, migraciones manuales.
8. **[08-fusion.md](08-fusion.md)** — Si vas a fusionar esta app con otra, este es tu documento
   principal: qué es acoplado, qué es portable, y el checklist de fusión.

## Reglas de mantenimiento de esta documentación

- Cada cambio de comportamiento relevante (nueva vista, nueva tabla, nueva regla visual, nuevo
  endpoint) debe reflejarse aquí en el documento que corresponda.
- Los documentos describen **hechos del código actual**, no aspiraciones. Si algo está pendiente,
  se marca explícitamente como pendiente.
- El idioma de la interfaz y de esta documentación es **español neutro**.
