# Gabe's Cut

Extensión de Chrome que estima ventas y revenue de juegos de la Steam store usando el método [Boxleiter](https://howtomarketagame.com/2021/04/26/the-boxleiter-method-for-estimating-steam-sales/) (reviews × multiplicador).

El nombre es un guiño al famoso 30% que Valve se queda de cada venta — esa deducción aparece en el panel literalmente como "Gabe's Cut".

> **Disclaimer:** proyecto independiente, sin afiliación con Valve ni con Steam. Los números son estimaciones aproximadas, útiles como orden de magnitud, no como cifras reales.

## Cómo funciona

Cuando entrás a una página de juego en `store.steampowered.com/app/...`, la extensión:

1. Lee el número de reviews y el precio del DOM.
2. Estima copias vendidas multiplicando reviews × 30 / 50 / 70 (low / mid / high).
3. Calcula revenue gross y aplica una cascada de deducciones para llegar al neto que se queda el dev:
   - Descuentos promedio en sales (-10%)
   - Refunds (-5%)
   - Regional pricing / PPP (-15%)
   - **Gabe's Cut** (-30%)
   - VAT opcional (-20%, off por default)
4. Inyecta un panel arriba del bloque de compra con los resultados.

## Instalación (modo desarrollador)

1. Cloná o descargá este repo.
2. Abrí `chrome://extensions`.
3. Activá **Developer mode** (arriba a la derecha).
4. Click en **Load unpacked** y elegí la carpeta del repo.
5. Navegá a cualquier juego en `https://store.steampowered.com/app/...`.

## Estructura

```
.
├── manifest.json          # Manifest V3
├── lib/
│   └── calc.js            # Boxleiter + cascada de deducciones
├── content/
│   ├── parser.js          # extrae reviews y precio del DOM
│   ├── inject.js          # arma el panel y maneja interacción
│   └── panel.css          # estilos del panel
└── icons/
    ├── icon.svg           # vector original
    ├── icon16.png / icon48.png / icon128.png
    └── generate-icons.ps1 # regenera los PNG desde el SVG
```

## Regenerar iconos

```powershell
pwsh ./icons/generate-icons.ps1
```

## Publicar en la Chrome Web Store

1. Empaquetar la raíz como zip (sin `.git`, sin `generate-icons.ps1`, sin docs).
2. Subir en https://chrome.google.com/webstore/devconsole (USD 5 una vez para registrarte).
3. Privacy practices: declarar que **no** se recolectan datos — la extensión solo lee el DOM local.
4. **No** usar el logo de Steam ni el branding de Valve en screenshots/iconos.

## Contribuir

Issues y PRs bienvenidos. Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Licencia

[MIT](LICENSE) © Juan Ignacio Roby
