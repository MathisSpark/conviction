/**
 * Research tools exposed to specialist subagents.
 *
 * Each tool is a Claude tool definition + a handler. Specialists pull from
 * these to build their opinions. Keep handlers small and robust — they run
 * unattended for hours during the hands-off window.
 */

import type { Tool } from "./claude.ts";
import * as jupiter from "./jupiter.ts";

export const tools: Tool[] = [
  {
    name: "search_web",
    description: "Search the web for recent news, articles, and discussion about a topic. Returns top results with title + snippet + URL. Use for breaking news, earnings reports, supply chain signals, executive moves.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query. Be specific (e.g. 'Tesla Q2 2026 delivery estimates analyst consensus')." },
        max_results: { type: "integer", default: 5 },
      },
      required: ["query"],
    },
  },
  {
    name: "read_url",
    description: "Fetch a URL and return its main text content. Use to read a specific article, filing, or page found via search.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "get_x_posts",
    description: "Get recent X (Twitter) posts from a user or matching a query. Use for sentiment, executive signaling (e.g. Elon's posts on Tesla), or breaking-news velocity.",
    input_schema: {
      type: "object",
      properties: {
        from_user: { type: "string", description: "X handle without @ (optional)" },
        query: { type: "string", description: "Search query (optional)" },
        max_results: { type: "integer", default: 20 },
      },
    },
  },
  {
    name: "get_market_details",
    description: "Read the full details of a Jupiter Predict market: question, outcomes, current YES/NO prices, volume, liquidity, resolution criteria.",
    input_schema: {
      type: "object",
      properties: { market_id: { type: "string" } },
      required: ["market_id"],
    },
  },
];

export async function handle(name: string, input: any): Promise<string> {
  try {
    switch (name) {
      case "search_web":
        return JSON.stringify(await searchWeb(input.query, input.max_results ?? 5));
      case "read_url":
        return await readUrl(input.url);
      case "get_x_posts":
        return JSON.stringify(await getXPosts(input));
      case "get_market_details":
        return JSON.stringify(await jupiter.getMarket(input.market_id));
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (e: any) {
    return `Tool ${name} error: ${e.message}`;
  }
}

// ---- handlers ----

async function searchWeb(query: string, max: number): Promise<{ title: string; url: string; snippet: string }[]> {
  // Prefer Brave Search API if key present (very cheap), else Tavily, else stub.
  if (process.env.BRAVE_API_KEY) {
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max}`, {
      headers: { "X-Subscription-Token": process.env.BRAVE_API_KEY, Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`Brave ${r.status}`);
    const json: any = await r.json();
    return (json.web?.results ?? []).slice(0, max).map((x: any) => ({ title: x.title, url: x.url, snippet: x.description }));
  }
  if (process.env.TAVILY_API_KEY) {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: max }),
    });
    const json: any = await r.json();
    return (json.results ?? []).map((x: any) => ({ title: x.title, url: x.url, snippet: x.content }));
  }
  return [{ title: "NO SEARCH KEY", url: "", snippet: "Set BRAVE_API_KEY or TAVILY_API_KEY in .env" }];
}

async function readUrl(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 ConvictionAgent/0.1" } });
  if (!r.ok) return `Failed ${r.status} ${url}`;
  const html = await r.text();
  // Naive strip — sufficient for hackathon. Replace with readability lib v2.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 8000);
}

async function getXPosts(opts: { from_user?: string; query?: string; max_results?: number }): Promise<any[]> {
  // Hackathon stub: integrate twitterapi.io key (already used elsewhere by Mathis)
  if (!process.env.TWITTER_API_KEY) {
    return [{ note: "Set TWITTER_API_KEY (twitterapi.io)", from_user: opts.from_user, query: opts.query }];
  }
  const url = opts.from_user
    ? `https://api.twitterapi.io/twitter/user/last_tweets?userName=${opts.from_user}&count=${opts.max_results ?? 20}`
    : `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(opts.query ?? "")}&queryType=Latest`;
  const r = await fetch(url, { headers: { "x-api-key": process.env.TWITTER_API_KEY } });
  if (!r.ok) return [{ error: `twitterapi.io ${r.status}` }];
  const json: any = await r.json();
  return json.tweets ?? json.data ?? [];
}
