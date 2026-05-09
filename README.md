# Gabe's Cut

A Chrome extension that roughly estimates sales and revenue for any game on the Steam store, using the Boxleiter method (reviews × multiplier).

![Gabe's Cut panel on a small indie release (Arranger, 319 reviews)](screenshots/panel-arranger.png)

![Gabe's Cut panel on a big hit (Dave the Diver, ~48K reviews)](screenshots/panel-dave.png)

## About

I'm an indie game developer from Argentina, and I built this to make market research a little less painful for fellow indies. When you're sizing up a genre, scoping a competitor, or deciding whether a niche is worth your next two years, you usually end up doing back-of-the-napkin math from Steam's review counts. Gabe's Cut just inlines that math directly on the store page so you don't have to.

This extension was built with AI assistance (and maybe, just maybe, entirely with AI).

> **Disclaimer:** independent project, not affiliated with Valve or Steam. The numbers are rough estimates — useful as an order of magnitude, not as actual revenue figures.

## How it works

When you visit a game page on `store.steampowered.com/app/...`, the extension:

1. Reads the review count and listed price from the DOM.
2. Estimates copies sold using the Boxleiter method: `reviews × multiplier`. The method itself has been around for years and has been adapted by different analysts over time as Steam's review behavior evolved. The most widely cited modern figure of around **31 sales per review** comes from [Chris Zukowski's benchmarks](https://howtomarketagame.com/benchmarks/) — Chris is one of the most recognized voices in indie game marketing, and there's a reasonable consensus building around that number. Given that, the three tiers shipped here are **20x (low)**, **31x (mid, default)** and **55x (high)**. Click any tier in the panel to see how the revenue breakdown shifts — useful for stress-testing your assumptions on conservative vs. optimistic scenarios.
3. Computes gross revenue (`sales × listed price`) and applies a multiplicative cascade of deductions to estimate what the developer actually takes home:
   - Average sale discounts (-10%)
   - Refunds (-5%)
   - Regional pricing / PPP (-15%)
   - **Gabe's Cut** — Valve's 30% storefront fee, the namesake of this extension
   - VAT (-20%, optional, off by default)
4. Injects a panel above the purchase block with the full breakdown.

The "net to dev" figure usually lands around 40–50% of the theoretical gross. Yes, that's the part where your spreadsheet stops looking fun.

## A note on the methodology (please push back)

The reviews-to-sales multiplier is **genuinely contested**. Different researchers, different years, different game categories — they all produce different numbers. 31 is the central estimate I anchored to, but you'll find perfectly defensible cases for anything from ~20 to ~60 depending on genre, price point, region, and how aggressively a game prompts for reviews.

Same goes for the deduction cascade: -10% average discount, -5% refunds, -15% regional pricing — those are reasonable industry rules of thumb, not laws of physics. Your mileage will vary.

If you think any of these numbers are wrong, **please tell me — or just fix it yourself**. Open an issue, send a PR, or fork the repo and ship your own version with whatever multipliers you trust. Suggestions, debates, and "actually, here's a better source" comments are all very welcome. That's literally the point of having this on GitHub.

## The honest origin story

I was scrolling Steam one night, looking at random games and wondering — *huh, I wonder how this one actually did.* I remembered there was some Chrome extension floating around that did this kind of estimation, but every time I'd tried it, it worked half-broken. So I went *yeah, screw it, I'll just make my own*, and that's how this got started.

I haven't shipped it to the Chrome Web Store because, well, I've never shipped anything to the Chrome Web Store. Maybe I'll get the itch one day and figure out the dev console dance. Maybe I won't. Either way, the code is here — feel free to fork it, ship your own version, slap your name on it, sell it, whatever. The MIT license means I'm not going to come knocking.

## Install (the rustic way, since it's not on the Web Store)

1. Clone or download this repo.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right) — this is the part that makes you feel like a hacker for ten seconds.
4. Click **Load unpacked** and select the repo folder.
5. Browse to any game on `https://store.steampowered.com/app/...` and the panel appears.

## Project structure

```
.
├── manifest.json          # Manifest V3
├── lib/
│   └── calc.js            # Boxleiter math + deduction cascade
├── content/
│   ├── parser.js          # extracts reviews and price from the DOM
│   ├── inject.js          # builds the panel and handles interaction
│   └── panel.css          # panel styles
└── icons/
    ├── icon.svg
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Contributing

Issues and PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## References & further reading

- [How to Market a Game](https://howtomarketagame.com/) — Chris Zukowski's blog. Deep well of indie marketing analysis; the [Benchmarks](https://howtomarketagame.com/benchmarks/) page is the source for the default 31x multiplier.
- [Impress Games blog](https://impress.games/blog) — another solid source on Steam metrics, wishlist behavior, and indie launch dynamics.
- [Impress Steam revenue calculator](https://impress.games/steam-revenue-calculator) — Impress's own wishlist-to-revenue calculator. If you want a different methodology to cross-check the numbers Gabe's Cut spits out, this is a good place to start.

## Changelog

### 2026-05-09 — Tunable deductions

- **Average discount and refunds & returns are now sliders.** Both values were hardcoded before (10% and 5%); they're now adjustable in-panel via slider + numeric input combos and persist across pages and sessions via `chrome.storage.local`.
- **Defaults updated.** Average discount default raised from 10% to **25%** (the old 10% was optimistic for titles past their launch window — most copies are sold at a discount). Refunds & returns default raised from 5% to **10%**, matching the lower end of the indie return-rate range cited by industry tools.
- **Label clarified.** The "Refunds" deduction is now "Refunds & returns" — same concept, less ambiguous.

### 2026-05-09 — Parser fixes

- **Review count**: Steam recently split the review count between "your language" and "all languages", and the `meta[itemprop="reviewCount"]` tag now reports only the language-filtered figure. The parser now reads `.review_summary_count` (the cross-language total) as its primary source, with the meta tag and tooltip kept as fallbacks. Estimates on multi-language titles were previously undercounted — sometimes by 3x or more.
- **F2P games with paid DLCs**: the parser was scanning the whole document for `.discount_original_price`, which on a F2P page would match the first DLC on sale (e.g. War Thunder showing a "$70 base price" from a discounted DLC). Price detection is now scoped to the base game's purchase block.
- **Games with a demo**: when a game has a demo, Steam renders the demo's purchase block before the game's, which made the parser pick up the demo and report the title as F2P. The parser now skips purchase blocks that have no price elements (demos, playtests, soundtracks).

## License

[MIT](LICENSE) © Nacho Roby
