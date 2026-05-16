# Changelog

All notable changes to Gabe's Cut are listed here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [SemVer](https://semver.org/).

## [1.2.0] — 2026-05-16

### Fixed
- **Review count parser was picking the wrong number on some pages.** Steam shifts the "primary" review count between several DOM elements depending on the visitor's language/region filters — on games like *Mixtape* it would surface the per-language filtered count (e.g. *117*) instead of the cross-language total (*4,956*). The parser now collects every candidate it finds (`.review_summary_count`, both `meta[itemprop="reviewCount"]` entries, the tooltip HTML, and the legacy `.responsive_hidden` spans) and returns the maximum. The global total is always ≥ any filtered subset, so this fixes the bug as a side-effect.
- **Couldn't re-edit the review/price after clicking once without changing anything.** The editor was caching a reference to the original `<span>` and using it after `commit()` swapped it for a fresh node, so the second click silently no-op'd. The editor now re-queries by id on every click.

### Added
- **Manual review-count override.** Click the review number in the panel to edit it inline (Enter/blur applies, Esc cancels). The override is persisted per-app in `chrome.storage.local` so it survives page reloads. A small `↺ reset` button next to the number re-parses the live DOM and reverts to the detected value.
- **Manual base-price override.** Same UX as the review override but for the listed price — useful when Steam's region/currency display gets weird, when the page falls back to a non-US price, or when you simply want to model a different scenario. Persisted per-app; resets to the price we'd otherwise display (US MSRP when available).

### Changed
- Panel disclaimer is now a single line above the meta row covering both fields, with a bit more personality: *"Steam shows info however it pleases — if something looks off, just click the number and edit it yourself."*
- Editable values now show a small `✎` affordance and a dashed hover/focus outline to make the click target discoverable.
- When a base-price override is active, the label switches from *Base price (US)* to *Base price (manual)* so it's clear the number is user-supplied.
- Internally: the review/price editors share a single `wireInlineEditor` helper and the per-app override storage helpers were unified.

## [1.1.0] — 2026-05-10

### Added
- **US pricing anchor** — revenue calculations now use the US MSRP fetched in the background instead of whatever regional/currency price the visitor happens to see. This makes the figures comparable across geographies. Falls back to the local DOM price if the US fetch fails, with a visible warning.
- **Gamalytic comparison panel** — fetches a third-party estimate (copies sold, players, revenue, review score, playtime, followers, wishlists, accuracy) so you can sanity-check the Boxleiter math against an independent source. Cached with a manual refresh link.
- **Tunable deductions** — the *Average discounts* and *Refunds & returns* rates are now sliders in the panel, with sensible defaults (25% / 10%) and a reset button.

### Changed
- Multipliers explicitly anchored to Chris Zukowski's benchmarks: 20× (low) / 31× (mid, default) / 55× (high).
- Methodology section in the README expanded with Boxleiter attribution and Impress source references.
- All panel and docs strings translated to English; project framed for a wider audience.
- README rewritten with origin story, screenshots, MIT-license invitation, and a more honest tone on the methodology limits.

### Fixed
- Review-count parser: handles F2P games with paid DLCs and games that ship a demo without conflating the demo block as the base game.

## [1.0.0] — 2026-05-08

### Added
- Initial public release.
- Boxleiter-method estimator injected above the purchase block on `store.steampowered.com/app/*` pages.
- Sales tiers (low/mid/high) and a multiplicative revenue cascade: discounts → refunds → regional pricing → Valve's 30% cut → optional VAT.

[1.2.0]: https://github.com/nacho-roby/gabes-cut/releases/tag/v1.2.0
[1.1.0]: https://github.com/nacho-roby/gabes-cut/releases/tag/v1.1.0
[1.0.0]: https://github.com/nacho-roby/gabes-cut/releases/tag/v1.0.0
