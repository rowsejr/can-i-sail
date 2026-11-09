# ⛵ Can I Sail? – Margate Harbour

A zero-dependency, single-file web app that answers the question every Margate sailor asks:
**"Can I get in and out of the harbour today?"**

---

## What it does

- Shows a **7-day rolling forecast** starting from today (14 days or a month at a tap)
- Uses **real PLA tidal predictions** for Margate (Apr – Dec 2026), embedded directly in the page — no API calls, no uploads
- Works out when the water rises above the height she floats at, and when it falls below it again, **to the minute**
- Optionally shows when you can **step off** onto the sand after she settles
- Fetches **live hourly weather** (wind knots, gusts, rain, cloud cover, pressure) from [Open-Meteo](https://open-meteo.com) for the Margate location (51.3904 N, 1.3791 E)
- Displays per-window hourly weather tables during sailable periods, and a midday snapshot on no-sail days
- Mobile-first dark nautical UI, works offline for tides once cached

---

## How the times are worked out

1. **High and low water** come from the PLA tide table (times in GMT, shown in UK time).
2. **In between**, the height follows Margate's own tide curve, not a cosine. Here the ebb runs off faster than a cosine
   in its middle hours, so the old cosine kept the water about 5 minutes too long on every falling tide (up to 11).
   The curve comes from the MARC hydrodynamic model (Ifremer/SHOM, through OhMyWind) for 9–25 Nov 2026, for neaps
   and springs, blended by each tide's range (`SHAPE` in `index.html`).
3. **Crossings are solved**, not sampled. The old version checked every 10 minutes and reported the first check below
   the height, so the end of a window came out up to 10 minutes late on top of the cosine error. Together the two made
   falling-tide times about 10 minutes late on average in November 2026, and up to 18.
4. **Air pressure** (on by default): tide tables assume average pressure. Each hPa above 1013 holds the sea about 1 cm
   lower, so a 1030 hPa high brings a falling tide's times roughly 10 minutes earlier. This uses the forecast pressure
   for the next 8 days. Wind can push the water further either way; that is not modelled.

These are predictions. Check the water before you rely on them.

## Tune it to your boat and mooring

The panel at the bottom of the page (settings are kept on that phone):

- **Afloat above**: the height of tide she floats at, and can get in and out of the harbour (default 3.2 m).
- **Step off below**: the height at which you can get off onto the sand after she settles. Blank until you know it.
- **Log what you see**: tap *She's floating now*, *Touched bottom now* or *Stepped off now* at the moment it happens,
  or add a past time. The app works out the height of the water at that moment. Once something is logged, the middle
  of your logs is used instead of the number typed above. A few logs on different tides (springs and neaps) tune it to
  your mooring. A log on the wrong tide (stepping off while the tide is rising, say) is refused.

## When the tide table runs out

The embedded PLA predictions end on **31 December 2026**. Days after that say "No tide table" (they used to show
"No Sailing"). Add the next year's PLA high and low waters to `RAW_TIDES` in the same format:
`["2027-01-01","05:02",4.42,"H"]` (date, GMT time, height above chart datum, H or L).

---

## Tests

```
node tests/tide_test.js
```

Runs the page's own script without a browser. It checks that the curve passes through every PLA turning point and
never turns back, and that crossings match a one-second scan. It also checks the pressure correction, tuning from logs
and that every window from April to December is listed once.

---

## Run locally

Just open the file directly — no server or build step required:

```
# Option A – file:// in any browser
start index.html              # Windows
open  index.html              # macOS

# Option B – one-liner dev server (Python built-in)
python -m http.server 8080
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
   | Build output directory | `/` (the top of the repo, where `index.html` is) |

4. Click **Save and Deploy**. Cloudflare will serve `index.html` globally via its CDN.

The `_redirects` file ensures the root URL always resolves to `index.html`.

---

## Data sources & notes

| Data | Source |
|---|---|
| Tidal predictions | PLA Margate HW/LW tables (2026) |
| Afloat height | 3.2 m by default, tunable (Margate Harbour entrance) |
| Curve between HW and LW | Margate's own shape (MARC model), see "How the times are worked out" |
| Weather | [Open-Meteo](https://open-meteo.com) free API — no key required |
| Times | PLA data is GMT; shown in UK time (BST from the last Sunday in March to the last Sunday in October) |

---

## License

MIT