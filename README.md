# ⛵ Can I Sail? – Margate Harbour

A zero-dependency, single-file web app that answers the question every Margate sailor asks:
**"Can I get in and out of the harbour today?"**

---

## What it does

- Shows a **7-day rolling forecast** starting from today
- Uses **real PLA tidal predictions** for Margate (Apr – Dec 2026), embedded directly in the page — no API calls, no uploads
- Applies **cosine interpolation** between HW/LW turning points to find every window when the water depth exceeds **3.2 m**
- Fetches **live hourly weather** (wind knots, gusts, rain, cloud cover) from [Open-Meteo](https://open-meteo.com) for the Margate location (51.3904 N, 1.3791 E)
- Displays per-window hourly weather tables during sailble periods, and a midday snapshot on no-sail days
- Mobile-first dark nautical UI, works offline for tides once cached

---

## Project structure

```
tidal-info-app/
├── src/
│   └── index.html     ← entire app (HTML + CSS + JS, no build step)
├── _redirects         ← Cloudflare Pages SPA routing rule
├── .gitignore
└── README.md
```

> All historic CSV data files have been processed and their contents embedded inside `index.html`. The raw CSVs are no longer needed in the repo.

---

## Run locally

Just open the file directly — no server or build step required:

```
# Option A – file:// in any browser
start src/index.html          # Windows
open  src/index.html          # macOS

# Option B – one-liner dev server (Python built-in)
python -m http.server 8080 --directory src
# then visit http://localhost:8080
```

Weather will fetch from Open-Meteo as normal; tides work entirely offline.

---

## Deploy to Cloudflare Pages

1. Push this folder to a GitHub (or GitLab) repository.
2. In the [Cloudflare Pages dashboard](https://dash.cloudflare.com), click **Create application → Pages → Connect to Git**.
3. Select your repo. Use these settings:

   | Setting | Value |
   |---|---|
   | Framework preset | **None** |
   | Build command | *(leave empty)* |
   | Build output directory | `src` |

4. Click **Save and Deploy**. Cloudflare will serve `src/index.html` globally via its CDN.

The `_redirects` file ensures the root URL always resolves to `index.html`.

---

## Data sources & notes

| Data | Source |
|---|---|
| Tidal predictions | PLA Margate HW/LW tables (2026) |
| Depth threshold | 3.2 m (Margate Harbour entrance) |
| Interpolation | Cosine (between consecutive HW/LW pairs) |
| Weather | [Open-Meteo](https://open-meteo.com) free API — no key required |
| Times | All UTC/GMT — remember BST offset (UTC+1) May–Oct |

---

## License

MIT