# CoolPro HVAC — Samsung AC demo shop

Static, single-page shop (no build step). Open `index.html` in a browser.

**Setup guide (Thai): [SETUP.md](SETUP.md)**. It covers live prices from Google Sheets, GitHub Pages, and lead capture to Sheets + LINE OA.

Live: https://dechax1.github.io/My-shop/ (after Pages is enabled on `main`)

## Features
- **Product catalog**: Wind-Free wall, 4-way/1-way cassette, Ceiling & Floor. Filter by type, pick a capacity, add to quote.
- **BTU calculator**: area × room factor (700–950 BTU/h·m²), +10/20 % for sun load, ceiling-height scaling, +600 BTU/h per extra occupant. Rounds up to a standard size and highlights matching models.
- **Energy / payback calculator**: kWh/yr = BTU/h × h/yr ÷ SEER ÷ 1000 (SEER per TIS 2134 / ISO 16358). Shows annual savings, payback, CO₂ (0.5 kgCO₂/kWh), and a 10-year cumulative cost chart with the break-even point.
- **Quote drawer**: quantity editing, 5 % discount for 3+ units, VAT 7 %, copy-to-clipboard text for LINE or email. The cart is saved in localStorage.
- **DVM S2 project lead form**: preliminary TR estimate by building type.
- **Live price list**: reads a published Google Sheet CSV (`assets/config.js → productsCsvUrl`). Falls back to `assets/products.js` demo data.
- **Lead capture**: quote and project forms POST to a Google Apps Script web app (`integrations/google-apps-script/Code.gs`). The script appends to a `Leads` sheet and can push a LINE OA message and/or send an email. Protected by a honeypot, Thai phone validation, a per-phone rate limit, and formula-injection guards.

## Files
| Path | Purpose |
|---|---|
| `assets/config.js` | **The only file you need to edit**: Sheet URL, Apps Script URL, LINE link, phone, VAT/discount |
| `assets/products.js` | Demo/fallback product data |
| `data/products-template.csv` | Template to import into the Google Sheet `Products` tab |
| `integrations/google-apps-script/Code.gs` | Lead receiver (Sheet + LINE + email) |

## Caveats
- Prices and SEER values are **illustrative demo data**. Check them against the current Samsung price list and spec sheets before quoting.
- The BTU method is a rule of thumb for pre-selection. Projects need a proper heat-load calculation (ASHRAE) and Samsung selection software.
- Until `leadEndpoint` is set, the forms only copy the quote to the clipboard (and show the LINE link if configured).

![screenshot](screenshot.png)
