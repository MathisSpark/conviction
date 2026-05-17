/**
 * Telegram bridge — lets agents ping Mathis during the hands-off window
 * when they need human guidance and ingest his replies.
 *
 * Bot token in .env: TELEGRAM_BOT_TOKEN
 * Chat id auto-discovered on first reply, then cached to ./.telegram-chat
 *
 * Usage from agent code:
 *   await sendToMathis("Should I bump bankroll to $100? (yes/no)")
 *   const reply = await askMathis("Pick: A / B / C", 120_000)
 */
import { existsSync, readFileSync, writeFileSync } from "fs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_FILE = "./.telegram-chat";
const POLL_OFFSET_FILE = "./.telegram-offset";

function tgUrl(method: string): string {
  if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing in .env");
  return `https://api.telegram.org/bot${TOKEN}/${method}`;
}

function loadCachedChatId(): number | null {
  if (!existsSync(CHAT_FILE)) return null;
  const n = Number(readFileSync(CHAT_FILE, "utf-8").trim());
  return Number.isFinite(n) ? n : null;
}

function saveChatId(id: number) {
  writeFileSync(CHAT_FILE, String(id));
}

function loadOffset(): number {
  if (!existsSync(POLL_OFFSET_FILE)) return 0;
  return Number(readFileSync(POLL_OFFSET_FILE, "utf-8").trim()) || 0;
}

function saveOffset(n: number) {
  writeFileSync(POLL_OFFSET_FILE, String(n));
}

/**
 * Send a message to Mathis. If no chat_id is cached, sends to ALL recent
 * chats found via getUpdates (i.e. the first time you message the bot,
 * we discover your chat_id).
 */
export async function sendToMathis(text: string): Promise<{ ok: boolean; chatId?: number; error?: string }> {
  let chatId = loadCachedChatId();
  if (!chatId) {
    // Try to discover from recent updates
    chatId = await discoverChatId();
    if (!chatId) {
      return { ok: false, error: "no chat_id yet — message the bot once from Telegram so it can learn your chat_id" };
    }
    saveChatId(chatId);
  }
  const r = await fetch(tgUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  const json: any = await r.json();
  if (!json.ok) return { ok: false, chatId, error: json.description };
  return { ok: true, chatId };
}

async function discoverChatId(): Promise<number | null> {
  const r = await fetch(tgUrl("getUpdates"));
  const json: any = await r.json();
  const updates = json.result ?? [];
  for (let i = updates.length - 1; i >= 0; i--) {
    const u = updates[i];
    const c = u.message?.chat?.id ?? u.edited_message?.chat?.id;
    if (c) return c;
  }
  return null;
}

export type Update = {
  updateId: number;
  text: string;
  from: string;
  ts: number;
};

/**
 * Long-poll new updates. Persists offset so we never re-process old replies.
 */
export async function pollNewReplies(timeoutSec = 10): Promise<Update[]> {
  const offset = loadOffset();
  const r = await fetch(`${tgUrl("getUpdates")}?offset=${offset + 1}&timeout=${timeoutSec}`);
  const json: any = await r.json();
  const updates = json.result ?? [];
  const out: Update[] = [];
  let maxId = offset;
  for (const u of updates) {
    if (u.update_id > maxId) maxId = u.update_id;
    const msg = u.message ?? u.edited_message;
    if (!msg?.text) continue;
    out.push({
      updateId: u.update_id,
      text: msg.text,
      from: msg.from?.username ?? msg.from?.first_name ?? "?",
      ts: (msg.date ?? Math.floor(Date.now() / 1000)) * 1000,
    });
    // Also auto-learn chat_id
    if (msg.chat?.id) saveChatId(msg.chat.id);
  }
  if (maxId > offset) saveOffset(maxId);
  return out;
}

/**
 * Send a question and wait up to timeoutMs for a reply. Returns the reply
 * text or null on timeout.
 */
export async function askMathis(question: string, timeoutMs = 120_000): Promise<string | null> {
  const sent = await sendToMathis(`❓ *Question from Conviction agent:*\n\n${question}`);
  if (!sent.ok) return null;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const updates = await pollNewReplies(5);
    if (updates.length) {
      const latest = updates[updates.length - 1];
      return latest.text;
    }
  }
  return null;
}
