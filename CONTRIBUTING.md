# Contribuir a Gabe's Cut

¡Gracias por interesarte! Issues y PRs son bienvenidos.

## Levantar el proyecto

No hay build step — es JS vanilla cargado directo por el manifest.

1. Cloná el repo.
2. `chrome://extensions` → Developer mode → **Load unpacked** → elegí la carpeta.
3. Hacé cambios en `lib/`, `content/` o `manifest.json`.
4. Volvé a `chrome://extensions` y tocá el botón de reload de la extensión.
5. Recargá una página de juego en Steam para ver los cambios.

## Estructura

- `lib/calc.js` — lógica pura del método Boxleiter + cascada de deducciones. Sin DOM.
- `content/parser.js` — extrae reviews y precio del DOM de Steam. Si Steam cambia su markup, este archivo es lo primero que rompe.
- `content/inject.js` — construye el panel y maneja interacción (toggle de tier, VAT).
- `content/panel.css` — estilos del panel.

## Pull Requests

- Mantené los PRs chicos y enfocados.
- Si cambiás los multiplicadores o las deducciones de [lib/calc.js](lib/calc.js), justificá la fuente en la descripción del PR.
- Si Steam cambia su DOM y rompe el parser, abrí un issue con la URL del juego afectado.

## Issues

Plantilla mínima:

- **Qué pasó** vs **qué esperabas**.
- URL del juego en Steam donde se reproduce.
- Versión de Chrome y de la extensión.
- Captura del panel si aplica.

## Código de conducta

Sé respetuoso. Discutimos código y métodos, no personas.
