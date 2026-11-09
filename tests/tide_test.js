/* Tests for Can I Sail's tide logic (index.html), with no browser and no network.
   Run:  node tests/tide_test.js
   The page's script is run with window.CIS_TEST set, so it does not start; its functions are then called directly. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
let checks = 0, fails = 0;
function ok(c, what) { checks++; if (!c) { fails++; console.log('  FAIL: ' + what); } }
function near(got, want, tol, what) { ok(Math.abs(got - want) <= tol, `${what} (got ${got}, wanted ${want} ± ${tol})`); }

function load(saved) {   // a fresh copy of the page's script, with what this phone has saved
  const mem = Object.assign({}, saved || {});
  const ctx = { window: { CIS_TEST: true }, localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } }, console, Date, Math, JSON };
  vm.createContext(ctx);
  vm.runInContext(code + '\n;this.api = { TIDES, SHAPE, SETTINGS, shapeAt, segAt, tideTableAt, tideAt, surgeAt, crossings, windowsForDay, heights, dayBounds, renderDay, obsHeight, checkObs, DATA_END,'
    + ' setPressure: p => { PRESSURE = p; }, setObs: o => { OBS = o; }, setSettings: s => { SETTINGS = Object.assign(SETTINGS, s); } };', ctx);
  return { api: ctx.api, mem };
}
const { api: A } = load();
const MIN = 60000, HOUR = 3600000;
const at = s => Date.parse(s);

console.log('Margate tide shape');
for (const rising of [true, false]) for (const range of [1.5, 2.7, 3.2, 3.7, 4.6]) {
  ok(Math.abs(A.shapeAt(0, rising, range)) < 1e-9 && Math.abs(A.shapeAt(1, rising, range) - 1) < 1e-9, `shape runs from 0 to 1 (${rising ? 'flood' : 'ebb'}, range ${range})`);
  let prev = -1, mono = true; for (let f = 0; f <= 1.0000001; f += 0.001) { const v = A.shapeAt(f, rising, range); if (v < prev - 1e-12) mono = false; prev = v; }
  ok(mono, `shape never turns back (${rising ? 'flood' : 'ebb'}, range ${range})`);
}
const cos = f => (1 - Math.cos(Math.PI * f)) / 2;
ok(A.shapeAt(0.5, false, 3.7) > cos(0.5) + 0.03, 'at springs the ebb is further down by half time than a cosine (water goes sooner)');
ok(A.shapeAt(0.35, true, 3.7) < cos(0.35) - 0.01, 'and the flood a little behind a cosine early on');
for (const t of A.TIDES.slice(0, 50)) near(A.tideTableAt(t.ts), t.height, 1e-9, 'the curve passes through every PLA high and low water');
ok(A.tideTableAt(A.TIDES[0].ts - MIN) === null && A.tideTableAt(A.DATA_END + MIN) === null, 'no heights outside the tide table');

console.log('Exact crossings');
const d0 = at('2026-11-09T00:00:00Z'), d1 = at('2026-11-12T00:00:00Z');
const cr = A.crossings(d0, d1, 3.2);
let scan = [], prev = A.tideAt(d0) >= 3.2;   // a one-second scan to compare with
for (let t = d0 + 1000; t < d1; t += 1000) { const now = A.tideAt(t) >= 3.2; if (now !== prev) scan.push({ ts: t, rising: now }); prev = now; }
ok(cr.length === scan.length && cr.length >= 10, `as many crossings as a one-second scan finds (${cr.length} and ${scan.length})`);
cr.forEach((c, i) => { near(c.ts, scan[i].ts, 6000, 'crossing within a few seconds of the scan'); ok(c.rising === scan[i].rising, 'same direction'); });
cr.forEach(c => near(A.tideAt(c.ts), 3.2, 0.002, 'the water is at the height at the crossing'));

console.log('Against the old method (cosine, checked every 10 minutes)');
function oldEnd(ds) {   // the app's previous sailingWindows(), for the window ends
  const T = A.TIDES, [y, mo, dy] = ds.split('-').map(Number), start = Date.UTC(y, mo - 1, dy);
  const old = ts => { for (let i = 0; i < T.length - 1; i++) if (T[i].ts <= ts && T[i + 1].ts > ts) { const f = (ts - T[i].ts) / (T[i + 1].ts - T[i].ts); return T[i].height + (T[i + 1].height - T[i].height) * cos(f); } return null; };
  const ends = []; let inWin = false;
  for (let m = 0; m <= 1440; m += 10) { const ts = start + m * MIN, h = old(ts); if (h === null) continue; if (h >= 3.2 && !inWin) inWin = true; else if (h < 3.2 && inWin) { ends.push(ts); inWin = false; } }
  return ends;
}
let diffs = [];
for (let d = at('2026-11-01T00:00:00Z'); d < at('2026-12-01T00:00:00Z'); d += 86400000) {
  const ds = new Date(d).toISOString().slice(0, 10), oe = oldEnd(ds), ne = A.windowsForDay(ds).map(w => w.end).filter(t => t >= d && t < d + 86400000);
  oe.forEach(o => { const n = ne.find(x => Math.abs(x - o) < 2 * HOUR); if (n) diffs.push((o - n) / MIN); });
}
const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
console.log(`  November: the old app ended windows ${mean.toFixed(1)} min later on average (most ${Math.max(...diffs).toFixed(0)}, least ${Math.min(...diffs).toFixed(0)}), over ${diffs.length} falling tides`);
ok(diffs.length > 40 && mean > 5 && mean < 15, 'the new falling-tide times are earlier than the old ones by about 5-15 minutes on average');
ok(Math.min(...diffs) > -2, 'and never meaningfully later');

console.log('Air pressure');
const w0 = A.windowsForDay('2026-11-10')[0];
A.setPressure({ t0: at('2026-11-03T00:00:00Z'), p: new Array(15 * 24).fill(1033) });
near(A.surgeAt(at('2026-11-10T12:00:00Z')), -0.2, 1e-9, '1033 hPa holds the water 0.20 m down');
const w1 = A.windowsForDay('2026-11-10')[0];
const early = (w0.end - w1.end) / MIN;
ok(early > 8 && early < 25, `so the window ends earlier (${early.toFixed(0)} min)`);
ok(w1.start > w0.start, 'and starts later');
A.setSettings({ pressure: false });
near(A.windowsForDay('2026-11-10')[0].end, w0.end, 1, 'switched off, it is the tide table again');
A.setSettings({ pressure: true });
near(A.surgeAt(at('2026-11-25T12:00:00Z')) === null ? 1 : 0, 1, 0, 'no correction past the forecast');
A.setPressure(null);

console.log('Tuning from what you logged');
const offs = A.crossings(at('2026-11-10T00:00:00Z'), at('2026-11-14T00:00:00Z'), 2.6).filter(c => !c.rising);
A.setObs([{ kind: 'stepoff', ts: offs[0].ts, surge: null }, { kind: 'stepoff', ts: offs[2].ts + 4 * MIN, surge: null }, { kind: 'stepoff', ts: offs[4].ts - 3 * MIN, surge: null }]);
const H = A.heights();
ok(H.logged.stepoff && Math.abs(H.stepOff - 2.6) < 0.05, `three step-off logs near the 2.6 m time give a step-off height near 2.6 m (${H.stepOff.toFixed(3)})`);
const ws = A.windowsForDay('2026-11-16');
ok(ws.length > 0 && ws.every(w => w.stepOff && w.stepOff > w.end), 'every window then shows a step-off time, after it ends');
const ups = A.crossings(at('2026-11-10T00:00:00Z'), at('2026-11-12T00:00:00Z'), 3.0).filter(c => c.rising);
A.setObs([{ kind: 'float', ts: ups[0].ts, surge: null }]);
near(A.heights().rise, 3.0, 0.001, 'one float log sets the afloat height');
near(A.heights().fall, 3.0, 0.001, 'and the falling one with it, until a touched-bottom time is logged');
A.setObs([{ kind: 'float', ts: ups[0].ts, surge: null }, { kind: 'aground', ts: A.crossings(ups[0].ts, ups[0].ts + 10 * HOUR, 2.9).filter(c => !c.rising)[0].ts, surge: null }]);
near(A.heights().fall, 2.9, 0.001, 'a touched-bottom log sets the falling height on its own');
const wd = A.windowsForDay('2026-11-11')[0];
near(A.tideAt(wd.start), 3.0, 0.002, 'windows start at the afloat height'); near(A.tideAt(wd.end), 2.9, 0.002, 'and end at the touched-bottom height');
A.setObs([]);
// 8 Nov: low water 04:57, high water 11:05, low water 17:28
ok(A.checkObs('stepoff', at('2026-11-08T14:00:00Z')) === '', 'stepping off on a falling tide is accepted');
ok(/rising/.test(A.checkObs('stepoff', at('2026-11-08T06:49:00Z'))) && /low water 04:57/.test(A.checkObs('stepoff', at('2026-11-08T06:49:00Z'))), 'stepping off on a rising tide is refused, with the low water time');
ok(A.checkObs('stepoff', at('2026-11-08T05:20:00Z')) === '', 'but not within half an hour after low water');
ok(A.checkObs('float', at('2026-11-08T08:00:00Z')) === '' && /falling/.test(A.checkObs('float', at('2026-11-08T14:00:00Z'))), 'floating is logged on a rising tide');
ok(/not happened/.test(A.checkObs('float', Date.now() + 3 * HOUR)), 'a time still to come is refused');
ok(/no tide table/.test(A.checkObs('float', at('2027-03-01T08:00:00Z'))), 'so is one past the tide table');
const saved = load({ 'cis.settings': JSON.stringify({ win: 9, stepOff: 'x', pressure: 'yes' }), 'cis.obs': JSON.stringify([{ kind: 'nonsense', ts: 1 }, { kind: 'float' }]) }).api;
ok(saved.SETTINGS.win === 3.2 && saved.SETTINGS.stepOff === null && saved.SETTINGS.pressure === true && saved.heights().logged.float === false, 'bad saved settings and logs are ignored');

console.log('Days, summer time and the end of the table');
const seen = new Set(); let missing = 0, dup = 0;
for (let d = at('2026-04-02T12:00:00Z'); d < at('2026-12-30T12:00:00Z'); d += 86400000) {
  const ds = new Date(d).toISOString().slice(0, 10), [b0, b1] = A.dayBounds(ds);
  for (const w of A.windowsForDay(ds)) { ok(w.end > b0 && w.start < b1, 'a window shown on a day overlaps that day'); if (w.start >= b0 && w.start < b1) { if (seen.has(w.start)) dup++; seen.add(w.start); } }
}
const allUps = A.crossings(at('2026-04-02T23:00:00Z'), at('2026-12-30T00:00:00Z'), 3.2).filter(c => c.rising);
allUps.forEach(u => { if (!seen.has(u.ts)) missing++; });
ok(missing === 0 && dup === 0, `every window from April to December is listed once, on the day it starts (${allUps.length} windows, ${missing} missing, ${dup} twice)`);
const [s0, s1] = A.dayBounds('2026-06-14');
ok(s0 === at('2026-06-13T23:00:00Z') && s1 === at('2026-06-14T23:00:00Z'), 'a summer day runs midnight to midnight BST');
ok(/No tide table/.test(A.renderDay('2027-01-02', null)), 'a day past the tide table says so instead of "No Sailing"');
let threw = 0;
for (const st of [{}, { stepOff: 2.5 }, { win: 4.4 }]) { A.setSettings(Object.assign({ win: 3.2, stepOff: null }, st)); for (let d = at('2026-04-01T12:00:00Z'); d < at('2027-01-05T12:00:00Z'); d += 86400000) { try { A.renderDay(new Date(d).toISOString().slice(0, 10), null); } catch (e) { threw++; } } }
ok(threw === 0, 'every day from April to January draws without an error, with and without a step-off height');

console.log(`\n${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
