# Gabe's Cut

A Chrome extension that estimates sales and revenue for any game on the Steam store, using the [Boxleiter method](https://howtomarketagame.com/2021/04/26/the-boxleiter-method-for-estimating-steam-sales/) (reviews × multiplier).

## About

I'm an indie game developer from Argentina, and I built this to make market research a little less painful for fellow indies. When you're sizing up a genre, scoping a competitor, or deciding whether a niche is worth your next two years, you usually end up doing back-of-the-napkin math from Steam's review counts. Gabe's Cut just inlines that math directly on the store page so you don't have to.

This extension was built with AI assistance (and maybe, just maybe, entirely with AI).

> **Disclaimer:** independent project, not affiliated with Valve or Steam. The numbers are rough estimates — useful as an order of magnitude, not as actual revenue figures.

## How it works

When you visit a game page on `store.steampowered.com/app/...`, the extension:

1. Reads the review count and listed price from the DOM.
2. Estimates copies sold using the Boxleiter method: `reviews × multiplier`, where the multiplier is **30 (low)**, **50 (mid)** or **70 (high)**. You can click any of the three tiers in the panel to see how the revenue breakdown shifts — useful for stress-testing your assumptions on conservative vs. optimistic scenarios.
3. Computes gross revenue (`sales × listed price`) and applies a multiplicative cascade of deductions to estimate what the developer actually takes home:
   - Average sale discounts (-10%)
   - Refunds (-5%)
   - Regional pricing / PPP (-15%)
   - **Gabe's Cut** — Valve's 30% storefront fee, the namesake of this extension
   - VAT (-20%, optional, off by default)
4. Injects a panel above the purchase block with the full breakdown.

The "net to dev" figure usually lands around 40–50% of the theoretical gross. Yes, that's the part where your spreadsheet stops looking fun.

## The honest origin story

This wasn't planned. One restless night I was scrolling Steam, looking at random games, doing the same dumb mental loop every indie dev does — *I wonder how this one did. And this one. And this one.* At some point I caught myself, opened a chat window, and prompted the idea into existence.

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

## License

[MIT](LICENSE) © Nacho Roby
