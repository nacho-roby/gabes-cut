# Contributing to Gabe's Cut

Thanks for your interest! Issues and PRs are welcome.

## Running locally

There's no build step — it's plain JS loaded directly by the manifest.

1. Clone the repo.
2. `chrome://extensions` → Developer mode → **Load unpacked** → pick the folder.
3. Make changes in `lib/`, `content/`, or `manifest.json`.
4. Go back to `chrome://extensions` and hit the reload button on the extension card.
5. Refresh a Steam game page to see the changes.

## Project layout

- `lib/calc.js` — pure logic for the Boxleiter method + deduction cascade. No DOM access.
- `content/parser.js` — extracts reviews and price from Steam's DOM. If Steam changes its markup, this is the first file that breaks.
- `content/inject.js` — builds the panel and handles interaction (tier toggle, VAT).
- `content/panel.css` — panel styles.

## Pull requests

- Keep PRs small and focused.
- If you change the multipliers or deductions in [lib/calc.js](lib/calc.js), justify the source in the PR description.
- If Steam changes its DOM and the parser breaks, please open an issue with the URL of the affected game page.

## Issues

Minimum template:

- **What happened** vs **what you expected**.
- URL of the Steam game where the issue reproduces.
- Chrome version and extension version.
- Screenshot of the panel if relevant.

## Code of conduct

Be respectful. We discuss code and methodology, not people.
