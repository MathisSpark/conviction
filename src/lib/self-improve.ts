/**
 * Self-improvement loop.
 *
 * Every N cycles, the orchestrator calls reflect(). It reads the recent
 * trail entries + active skills, then asks Claude (Sonnet) "what skill,
 * if I had it, would have helped me on the last trades?". If the model
 * proposes one, we write it to /skills/proposals/, then a smaller Haiku
 * call reviews it against a safety checklist. If passes, promote to
 * /skills/active/.
 *
 * Hard limits (PRD §6.4):
 * - Skills are PROMPT additions only. They cannot edit code.
 * - Cannot change MAX_BET_USD, bankroll, or wallet permissions.
 * - Cannot delete or override existing active Skills.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync, appendFileSync } from "fs";
import { loadActiveSkills, writeProposal, promoteToActive } from "./skills.ts";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TRAIL_FILE = process.env.TRAIL_FILE ?? "./trail.jsonl";
const REFLECT_FILE = process.env.REFLECT_FILE ?? "./reflect.jsonl";

const FORBIDDEN_WORDS = [
  "MAX_BET_USD", "TOTAL_BANKROLL_USD", "DRAWDOWN_STOP_PCT",
  "wallet", "private key", "seed phrase",
  "delete", "remove", "override existing",
];

export async function reflectAndPropose(): Promise<{ proposed?: string; accepted?: string; reason: string }> {
  const trail = readRecentTrail(50);
  if (trail.length < 3) return { reason: "not enough trail data yet" };

  const active = loadActiveSkills().map(s => s.name).join(", ");

  const sys = `You are the meta-improver of the Conviction trading agent.

Your job: read the last few trail entries from a real trading session and propose ONE new skill (if and only if you see a concrete improvement). A skill is a SKILL.md file with YAML frontmatter (name, description) and a body of instructions.

HARD RULES:
- Skills are PROMPT additions. They CANNOT change trading caps, wallet permissions, or code.
- Propose at most ONE skill per call.
- The skill must NAME a specific pattern you observed in the trail (cite the cycle, the marketId).
- If no clear improvement: respond with {"skip": true, "reason": "..."}.

CURRENTLY ACTIVE SKILLS (do not duplicate or contradict): ${active || "none"}.

OUTPUT FORMAT (JSON only):
{
  "skip": false,
  "slug": "kebab-case-name",
  "name": "human-readable name",
  "description": "one-line: what it does + when to use it",
  "body": "markdown skill body — workflow + rules of thumb",
  "evidence": "one-sentence reference to what trail entries motivated this"
}`;

  const user = `Recent trail (newest last):\n\n${trail.map(t => JSON.stringify(t)).join("\n")}\n\nPropose a skill or skip.`;

  const r = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: sys,
    messages: [{ role: "user", content: user }],
  });
  const text = r.content.filter(b => b.type === "text").map((b: any) => b.text).join("");
  const parsed = extractJson(text);
  if (parsed.skip) {
    logReflect({ ts: Date.now(), action: "skip", reason: parsed.reason });
    return { reason: `model skipped: ${parsed.reason}` };
  }

  const required = ["slug", "name", "description", "body"];
  for (const k of required) {
    if (!parsed[k]) {
      logReflect({ ts: Date.now(), action: "invalid", reason: `missing ${k}` });
      return { reason: `model output missing ${k}` };
    }
  }

  // Safety check
  const blob = JSON.stringify(parsed).toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (blob.includes(word.toLowerCase())) {
      logReflect({ ts: Date.now(), action: "blocked", reason: `forbidden token: ${word}`, slug: parsed.slug });
      return { reason: `blocked: contains forbidden token "${word}"` };
    }
  }

  // Slug uniqueness check
  const existingNames = new Set(loadActiveSkills().map(s => s.name));
  if (existingNames.has(parsed.name)) {
    logReflect({ ts: Date.now(), action: "duplicate", slug: parsed.slug });
    return { reason: `duplicate name: ${parsed.name}` };
  }

  const path = writeProposal(parsed.slug, { name: parsed.name, description: parsed.description }, parsed.body);
  logReflect({ ts: Date.now(), action: "proposed", slug: parsed.slug, path });

  // Auto-accept after acceptor pass (haiku check)
  const ok = await acceptorReview(parsed);
  if (!ok.accept) {
    logReflect({ ts: Date.now(), action: "rejected", slug: parsed.slug, reason: ok.reason });
    return { proposed: parsed.slug, reason: `acceptor rejected: ${ok.reason}` };
  }

  const activePath = promoteToActive(parsed.slug);
  logReflect({ ts: Date.now(), action: "accepted", slug: parsed.slug, path: activePath });
  return { proposed: parsed.slug, accepted: parsed.slug, reason: "accepted" };
}

async function acceptorReview(skill: any): Promise<{ accept: boolean; reason: string }> {
  const sys = `You are the Skill Acceptor for an autonomous trading agent.

Validate a proposed Skill against this checklist:
1. Does it have a clear name + description that includes WHEN to use it?
2. Is the body actionable (steps / rules) rather than vague?
3. Does it NOT attempt to modify trading caps, wallet rules, or code?
4. Does it NOT contradict basic safety (no "ignore stop loss", "bet bigger", etc.)?
5. Is it grounded in a specific observation, not abstract?

Output JSON: {"accept": true/false, "reason": "short"}`;

  const r = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: sys,
    messages: [{ role: "user", content: `Skill to review:\n${JSON.stringify(skill, null, 2)}` }],
  });
  const text = r.content.filter(b => b.type === "text").map((b: any) => b.text).join("");
  try {
    const j = extractJson(text);
    return { accept: !!j.accept, reason: j.reason ?? "?" };
  } catch {
    return { accept: false, reason: "acceptor returned invalid JSON" };
  }
}

function readRecentTrail(n: number): any[] {
  if (!existsSync(TRAIL_FILE)) return [];
  const lines = readFileSync(TRAIL_FILE, "utf-8").trim().split("\n").slice(-n);
  return lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function logReflect(entry: any) {
  appendFileSync(REFLECT_FILE, JSON.stringify(entry) + "\n");
}

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const raw = (fence ? fence[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error(`No JSON in: ${text.slice(0, 200)}`);
  return JSON.parse(raw.slice(start, end + 1));
}
