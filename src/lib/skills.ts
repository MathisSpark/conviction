/**
 * Skills loader — filesystem-based capability modules per Anthropic's
 * Agent Skills pattern. Each /skills/active/<name>/SKILL.md has YAML
 * frontmatter (name, description) + a body of instructions.
 *
 * Loaded on every cycle so the orchestrator + specialists pick up any
 * Skill the agent self-wrote during the previous cycle.
 */

import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const SKILLS_ROOT = process.env.SKILLS_ROOT ?? "./skills";

export type Skill = {
  name: string;
  description: string;
  body: string;
  path: string;
};

export function loadActiveSkills(): Skill[] {
  const dir = join(SKILLS_ROOT, "active");
  if (!existsSync(dir)) return [];
  const skills: Skill[] = [];
  for (const entry of readdirSync(dir)) {
    const skillDir = join(dir, entry);
    if (!statSync(skillDir).isDirectory()) continue;
    const md = join(skillDir, "SKILL.md");
    if (!existsSync(md)) continue;
    try {
      skills.push(parseSkillFile(md));
    } catch (e: any) {
      console.error(`[skills] skip ${md}: ${e.message}`);
    }
  }
  return skills;
}

export function listProposals(): Skill[] {
  const dir = join(SKILLS_ROOT, "proposals");
  if (!existsSync(dir)) return [];
  const skills: Skill[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const skillDir = join(dir, entry);
    if (!statSync(skillDir).isDirectory()) continue;
    const md = join(skillDir, "SKILL.md");
    if (!existsSync(md)) continue;
    try {
      skills.push(parseSkillFile(md));
    } catch {}
  }
  return skills;
}

export function writeProposal(slug: string, frontmatter: { name: string; description: string }, body: string): string {
  const dir = join(SKILLS_ROOT, "proposals", slug);
  mkdirSync(dir, { recursive: true });
  const md = join(dir, "SKILL.md");
  const content = `---\nname: ${frontmatter.name}\ndescription: ${frontmatter.description}\n---\n\n${body.trim()}\n`;
  writeFileSync(md, content);
  return md;
}

export function promoteToActive(slug: string): string {
  const fromDir = join(SKILLS_ROOT, "proposals", slug);
  const toDir = join(SKILLS_ROOT, "active", slug);
  if (!existsSync(fromDir)) throw new Error(`proposal not found: ${slug}`);
  mkdirSync(toDir, { recursive: true });
  // copy SKILL.md
  const src = join(fromDir, "SKILL.md");
  const dst = join(toDir, "SKILL.md");
  writeFileSync(dst, readFileSync(src, "utf-8"));
  return dst;
}

/**
 * Render all active skills into a single string suitable for inclusion
 * in a system prompt. Keeps the size manageable by including only the
 * description by default; bodies are included only for "core" skills.
 */
export function renderSkillsForPrompt(skills: Skill[], opts?: { full?: boolean }): string {
  if (!skills.length) return "";
  const sections = skills.map(s => {
    const header = `## Skill: ${s.name}\n${s.description}`;
    return opts?.full ? `${header}\n\n${s.body}` : header;
  });
  return `\n\n=== ACTIVE SKILLS ===\n\n${sections.join("\n\n")}\n\n=== END SKILLS ===\n`;
}

function parseSkillFile(path: string): Skill {
  const raw = readFileSync(path, "utf-8");
  const m = raw.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error("missing YAML frontmatter");
  const fm: any = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    fm[k] = v;
  }
  if (!fm.name || !fm.description) throw new Error("missing name/description");
  return { name: fm.name, description: fm.description, body: m[2].trim(), path };
}
