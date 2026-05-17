/**
 * Thin Claude client wrapper.
 *
 * Orchestrator uses Opus 4.7 (heavy reasoning, dispatch decisions).
 * Specialists use Sonnet 4.6 (faster, cheaper, parallel runs).
 *
 * We use the raw Messages API with tool use so we can fan out subagents
 * cleanly and keep reasoning traces structured for the live dashboard.
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODELS = {
  orchestrator: "claude-opus-4-7",
  specialist: "claude-sonnet-4-6",
  fast: "claude-haiku-4-5-20251001",
} as const;

export type Tool = Anthropic.Messages.Tool;
export type ToolUseBlock = Anthropic.Messages.ToolUseBlock;
export type TextBlock = Anthropic.Messages.TextBlock;

export type AgentRunOpts = {
  model: keyof typeof MODELS;
  system: string;
  user: string;
  tools?: Tool[];
  toolHandler?: (name: string, input: any) => Promise<string>;
  maxTurns?: number;
  maxTokens?: number;
};

/**
 * Run a Claude agent loop with tool use. Returns the final text + the
 * full trace of tool calls (for the live dashboard reasoning view).
 */
export async function runAgent(opts: AgentRunOpts): Promise<{
  text: string;
  trace: { type: "tool_use" | "text"; name?: string; input?: any; output?: string; text?: string }[];
}> {
  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: opts.user }];
  const trace: any[] = [];
  const maxTurns = opts.maxTurns ?? 8;

  for (let turn = 0; turn < maxTurns; turn++) {
    const resp = await client.messages.create({
      model: MODELS[opts.model],
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      tools: opts.tools,
      messages,
    });

    const toolUses = resp.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    const texts = resp.content.filter((b): b is TextBlock => b.type === "text");

    for (const t of texts) trace.push({ type: "text", text: t.text });
    for (const tu of toolUses) trace.push({ type: "tool_use", name: tu.name, input: tu.input });

    if (resp.stop_reason === "end_turn" || toolUses.length === 0) {
      const finalText = texts.map(t => t.text).join("\n").trim();
      return { text: finalText, trace };
    }

    // Execute tools and feed results back
    messages.push({ role: "assistant", content: resp.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      if (!opts.toolHandler) throw new Error(`Tool requested but no handler: ${tu.name}`);
      const output = await opts.toolHandler(tu.name, tu.input);
      trace[trace.findIndex(t => t.type === "tool_use" && t.name === tu.name && !t.output)].output = output;
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: output });
    }
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(`Max turns (${maxTurns}) reached without end_turn`);
}
