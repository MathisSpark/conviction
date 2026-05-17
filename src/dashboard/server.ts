/**
 * Minimal live dashboard.
 *
 * Serves a single HTML page that streams:
 *  - Live PnL (from Jupiter getPositions every 10s)
 *  - Live reasoning trace (SSE tail of trail.jsonl)
 *  - Active Skills (with auto-update when /skills/active/ changes)
 *
 * Hono + Bun's native serve. ~150 lines, no build step.
 *
 * Run: bun run src/dashboard/server.ts
 */
import "../lib/env.ts";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { existsSync, readFileSync, statSync, watch } from "fs";
import { getPositions } from "../lib/jupiter.ts";
import { pubkey } from "../lib/wallet.ts";
import { loadActiveSkills } from "../lib/skills.ts";

const TRAIL = process.env.TRAIL_FILE ?? "./trail.jsonl";
const REFLECT = process.env.REFLECT_FILE ?? "./reflect.jsonl";
const PORT = Number(process.env.DASHBOARD_PORT ?? 3000);

const app = new Hono();

app.get("/", c => c.html(HTML));

app.get("/api/positions", async c => {
  try {
    const positions = await getPositions(pubkey());
    return c.json({ wallet: pubkey(), positions });
  } catch (e: any) {
    return c.json({ wallet: pubkey(), positions: [], error: e.message }, 500);
  }
});

app.get("/api/skills", c => {
  const skills = loadActiveSkills();
  return c.json({ count: skills.length, skills: skills.map(s => ({ name: s.name, description: s.description })) });
});

app.get("/api/trail", c => {
  if (!existsSync(TRAIL)) return c.json({ entries: [] });
  const lines = readFileSync(TRAIL, "utf-8").trim().split("\n").slice(-100);
  const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  return c.json({ entries });
});

app.get("/api/reflect", c => {
  if (!existsSync(REFLECT)) return c.json({ entries: [] });
  const lines = readFileSync(REFLECT, "utf-8").trim().split("\n").slice(-50);
  const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  return c.json({ entries });
});

app.get("/api/stream", c => {
  return stream(c, async (s) => {
    let lastSize = 0;
    if (existsSync(TRAIL)) lastSize = statSync(TRAIL).size;

    const send = async (data: any) => {
      await s.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    await send({ type: "hello", ts: Date.now() });

    // Poll trail every 1s
    const id = setInterval(() => {
      if (!existsSync(TRAIL)) return;
      const sz = statSync(TRAIL).size;
      if (sz <= lastSize) return;
      const buf = readFileSync(TRAIL, "utf-8");
      const lines = buf.slice(lastSize).split("\n").filter(Boolean);
      lastSize = sz;
      for (const l of lines) {
        try { send({ type: "trail", entry: JSON.parse(l) }); } catch {}
      }
    }, 1000);

    c.req.raw.signal.addEventListener("abort", () => clearInterval(id));
    // Keep alive
    await new Promise(() => {});
  });
});

console.log(`Conviction dashboard listening on http://localhost:${PORT}`);

Bun.serve({ port: PORT, fetch: app.fetch });

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Conviction · live</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif; margin: 0; padding: 24px; background: #0b0d10; color: #eee; }
  h1 { margin: 0 0 6px; font-size: 22px; letter-spacing: -0.5px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin: 18px 0 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card { background: #14181d; padding: 14px 16px; border-radius: 10px; }
  .mono { font-family: "JetBrains Mono", "SF Mono", Menlo, monospace; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #222; font-size: 13px; }
  th { color: #888; font-weight: 500; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
  .pnl-pos { color: #4ade80; }
  .pnl-neg { color: #f87171; }
  .trail { height: 320px; overflow-y: auto; background: #0a0c0f; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 11px; }
  .trail-line { padding: 2px 0; border-bottom: 1px dashed #1a1d22; }
  .pill { display: inline-block; padding: 1px 8px; border-radius: 10px; background: #1e2229; font-size: 11px; color: #aaa; margin-right: 6px; }
  .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
  .sub { color: #888; font-size: 12px; }
  .skill { padding: 8px; border-left: 2px solid #4ade80; margin-bottom: 6px; background: #11161b; }
  .skill-name { font-weight: 600; }
  .skill-desc { color: #888; font-size: 12px; margin-top: 2px; }
  a { color: #4ade80; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Conviction</h1>
      <div class="sub">AI market maker · live mainnet · Ralphthon @ SG · <span id="wallet" class="mono"></span></div>
    </div>
    <div class="sub" id="lastUpdate"></div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Open Positions</h2>
      <table id="positions">
        <thead><tr><th>Market</th><th>Side</th><th>Size</th><th>Entry</th><th>Mark</th><th>PnL</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="card">
      <h2>Active Skills <span class="pill" id="skillCount">0</span></h2>
      <div id="skills"></div>
    </div>
  </div>

  <h2>Reasoning Trace (live)</h2>
  <div class="trail" id="trail"></div>

<script>
async function refreshPositions() {
  try {
    const r = await fetch('/api/positions');
    const d = await r.json();
    document.getElementById('wallet').textContent = d.wallet?.slice(0, 8) + '…' + d.wallet?.slice(-6);
    const tbody = document.querySelector('#positions tbody');
    tbody.innerHTML = '';
    for (const p of (d.positions || [])) {
      const pnl = Number(p.pnlUsd ?? 0) / 1e6;
      const cls = pnl >= 0 ? 'pnl-pos' : 'pnl-neg';
      const title = (p.eventMetadata?.title ?? p.marketId) + (p.title ? ' — ' + p.title : '');
      const row = '<tr><td>' + title + '</td><td>' + (p.isYes ? 'YES' : 'NO') + '</td><td>' + p.contracts + '</td><td>$' + (Number(p.avgPriceUsd ?? 0) / 1e6).toFixed(2) + '</td><td>$' + (Number(p.markPriceUsd ?? 0) / 1e6).toFixed(2) + '</td><td class="' + cls + '">$' + pnl.toFixed(2) + '</td></tr>';
      tbody.insertAdjacentHTML('beforeend', row);
    }
  } catch (e) { console.error(e); }
}

async function refreshSkills() {
  const r = await fetch('/api/skills');
  const d = await r.json();
  document.getElementById('skillCount').textContent = d.count;
  document.getElementById('skills').innerHTML = (d.skills || []).map(s =>
    '<div class="skill"><div class="skill-name">' + s.name + '</div><div class="skill-desc">' + s.description + '</div></div>'
  ).join('');
}

async function loadInitialTrail() {
  const r = await fetch('/api/trail');
  const d = await r.json();
  const t = document.getElementById('trail');
  for (const e of (d.entries || []).slice(-30)) {
    appendTrail(e);
  }
}

function appendTrail(entry) {
  const t = document.getElementById('trail');
  const ts = new Date(entry.ts ?? Date.now()).toISOString().slice(11, 19);
  const type = entry.type ?? '?';
  const body = JSON.stringify(entry).slice(0, 300);
  t.insertAdjacentHTML('beforeend', '<div class="trail-line"><span class="pill">' + ts + '</span><span class="pill">' + type + '</span> ' + body + '</div>');
  t.scrollTop = t.scrollHeight;
}

const es = new EventSource('/api/stream');
es.onmessage = ev => {
  try {
    const d = JSON.parse(ev.data);
    if (d.type === 'trail') appendTrail(d.entry);
  } catch {}
};

setInterval(refreshPositions, 10000);
setInterval(refreshSkills, 15000);
setInterval(() => document.getElementById('lastUpdate').textContent = 'updated ' + new Date().toLocaleTimeString(), 1000);
loadInitialTrail();
refreshPositions();
refreshSkills();
</script>
</body>
</html>`;
