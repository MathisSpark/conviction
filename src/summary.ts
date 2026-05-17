/**
 * End-of-run summary — for the 19:00 pitch.
 *
 * Reads trail.jsonl, monitor.jsonl, reflect.jsonl, and live Jupiter
 * positions to produce a clean recap of what the agent did during the
 * 3h hands-off window.
 *
 * Run: bun run src/summary.ts
 */
import "./lib/env.ts";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { getPositions } from "./lib/jupiter.ts";
import { pubkey } from "./lib/wallet.ts";
import { loadActiveSkills } from "./lib/skills.ts";

const TRAIL = process.env.TRAIL_FILE ?? "./trail.jsonl";
const MONITOR = process.env.MONITOR_LOG ?? "./monitor.jsonl";

function readJsonl(path: string): any[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8").trim().split("\n").map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

const trail = readJsonl(TRAIL);
const monitor = readJsonl(MONITOR);

// --- cycles + reflects
const cycles = trail.filter(t => t.type === "cycle_start").length;
const reflects = trail.filter(t => t.type === "reflect");
const proposedSkills = reflects.filter(r => r.proposed).map(r => r.proposed);
const acceptedSkills = reflects.filter(r => r.accepted).map(r => r.accepted);

// --- trades
const executed = trail.filter(t => t.type === "desk_result" && t.status === "executed");
const skipped = trail.filter(t => t.type === "desk_result" && t.status === "skipped");
const errored = trail.filter(t => t.type === "desk_error");

let totalExposedUsd = 0;
const trades: any[] = [];
for (const e of executed) {
  const r = e.result;
  totalExposedUsd += r.sizing?.betUsd ?? 0;
  trades.push({
    marketId: r.market.marketId,
    question: r.market.question?.slice(0, 80) ?? "?",
    side: r.sizing.side,
    betUsd: r.sizing.betUsd,
    edgePct: r.sizing.edgePct ? (r.sizing.edgePct * 100).toFixed(1) : "?",
    forecast: r.opinion?.probabilityYes?.toFixed(2),
    txSig: r.txSig,
  });
}

// --- monitor actions
const stopLosses = monitor.filter(m => m.type === "stop_loss");
const takeProfits = monitor.filter(m => m.type === "take_profit");
const claims = monitor.filter(m => m.type === "claim_executed");

// --- skills on disk
const skills = loadActiveSkills();
const skillsRoot = process.env.SKILLS_ROOT ?? "./skills";
const proposalDir = join(skillsRoot, "proposals");
const proposals = existsSync(proposalDir)
  ? readdirSync(proposalDir).filter(n => !n.startsWith(".") && statSync(join(proposalDir, n)).isDirectory())
  : [];

// --- live positions + PnL
let positions: any[] = [];
let totalPnlUsd = 0;
try {
  positions = await getPositions(pubkey()) as any[];
  for (const p of positions) {
    totalPnlUsd += Number(p.pnlUsdAfterFees ?? p.pnlUsd ?? 0) / 1_000_000;
  }
} catch (e: any) {
  console.error("Failed to fetch positions:", e.message);
}

// --- telegram comms count
const telegramReplies = trail.filter(t => t.type === "mathis_reply").length;

// --- output

console.log(`
╔══════════════════════════════════════════════════════════════╗
║            CONVICTION — End-of-Run Summary                  ║
║            Ralphthon @ Singapore — 2026-05-17               ║
╚══════════════════════════════════════════════════════════════╝

Wallet: ${pubkey()}

📊 ACTIVITY
  Cycles run:           ${cycles}
  Trades executed:      ${executed.length}
  Trades skipped:       ${skipped.length}  (edge < threshold or already position)
  Trades errored:       ${errored.length}

🦞 BUILD (G1) — multi-agent system grew during run
  Initial skills:       3 (research-tech-companies, research-product-releases, kelly-position-sizing)
  Skills self-written:  ${acceptedSkills.length}
  Proposals (accepted): ${acceptedSkills.join(", ") || "—"}
  Proposals (drafted but pending/rejected): ${proposals.length - acceptedSkills.length}

💰 G2 — pipeline validated end-to-end (place + monitor + exit)
  Stop losses executed: ${stopLosses.length}
  Take profits executed: ${takeProfits.length}
  Claims executed:      ${claims.length}

🤝 G3 — autonomous operation
  Telegram replies acted on: ${telegramReplies}
  Human commits during run:  (run \`git log --since=13:00 --author=Mathis\` to check)

📈 LIVE STATE
  Total exposed (gross): $${totalExposedUsd.toFixed(2)}
  Open positions:        ${positions.length}
  Live PnL (mark):       $${totalPnlUsd.toFixed(2)}

🔁 TRADES (top 10 most recent)
${trades.slice(-10).map(t => `  ${t.side} $${t.betUsd}  edge ${t.edgePct}%  pYES=${t.forecast}  ${t.question}\n    tx: ${t.txSig}`).join("\n")}

✨ SKILLS WRITTEN BY THE AGENT
${acceptedSkills.length === 0
  ? "  (none yet — next reflect at cycle 10, 15, 20...)"
  : skills.filter(s => !["research-tech-companies", "research-product-releases", "kelly-position-sizing"].includes(s.name)).map(s => `  • ${s.name}\n    ${s.description}`).join("\n\n")
}

═══════════════════════════════════════════════════════════════
`);
