---
name: verify
description: Build/launch/drive recipe for verifying tree_clipper_website changes end-to-end in a real browser.
---

# Verifying tree_clipper_website

Full local stack (frontend + API against the real Supabase backend — the
publishable key lives in wrangler.jsonc, no secrets needed):

```bash
npm install                      # geonodes-web-render etc.
npx wrangler dev --port 8787 &   # API worker (src/index.js)
npx vite --port 3000 &           # frontend (public/), proxies /api/ to :8787
# ready when: curl localhost:3000 and localhost:8787/api/entries return 200
```

A good public test page (no login required):
`http://localhost:3000/jan-hendrik/gradient-from-image`

## Driving a browser

No Playwright in this env. Two handles that work:

- Quick screenshots — headless system Chrome:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --screenshot=out.png --window-size=900,900 --virtual-time-budget=10000 <url>`
- Computed-style / geometry measurements — `npm i puppeteer-core` in the
  scratchpad and launch with `executablePath` pointing at system Chrome
  (no browser download).

## Gotchas

- For responsive-layout work, don't eyeball screenshots — measure
  `getBoundingClientRect()` via puppeteer-core at a sweep of widths.
- Body horizontal padding is fluid: `clamp(24px, 6vw - 12px, 48px)`, so
  content width ≈ `0.88·vw + 22` between ~600 and ~1000px viewports.
- Vite serves styles.css as a JS module in dev; `curl .../styles.css | grep`
  still works for checking what's served.
