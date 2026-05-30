import { getSecret } from "./secrets";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

// ── OpenAI chat completion (direct, not via Hermes) ────────────────
// Uses Aydin's OPENAI_API_KEY from `.env`. Pay-per-token, no monthly cap.
// Typical 500-in/500-out call on gpt-4o ≈ $0.005 — cheaper than
// Copilot Pro flat-rate at ≤1500 calls/month.

export interface OpenAIRunOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export async function runOpenAI(
  opts: OpenAIRunOptions
): Promise<{ text: string; error?: string }> {
  const key = await getSecret("OPENAI_API_KEY");
  if (!key) {
    return { text: "", error: "OPENAI_API_KEY not configured" };
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (opts.systemPrompt?.trim()) {
    messages.push({ role: "system", content: opts.systemPrompt.trim() });
  }
  messages.push({ role: "user", content: opts.prompt });

  const model = opts.model || "gpt-4o";
  // The reasoning models (o-series, gpt-5) use different param names.
  const isReasoning = /^(o\d|gpt-5)/.test(model);
  const body: Record<string, unknown> = { model, messages };
  if (isReasoning) {
    body.max_completion_tokens = opts.maxOutputTokens ?? 4096;
  } else {
    body.max_tokens = opts.maxOutputTokens ?? 2048;
    if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  }

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        text: "",
        error: `OpenAI ${res.status}: ${text.slice(0, 300)}`,
      };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { text: "", error: "empty response" };
    return { text };
  } catch (err) {
    return {
      text: "",
      error: err instanceof Error ? err.message : "network error",
    };
  }
}

// ── Streaming variant — for Console (SSE) ──────────────────────────
// Forwards text deltas to `onChunk` as they arrive. Returns the full
// accumulated text at the end (also captured for vault auto-save).

export interface StreamResult {
  full: string;
  error?: string;
}

export async function streamOpenAI(
  opts: OpenAIRunOptions,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<StreamResult> {
  const key = await getSecret("OPENAI_API_KEY");
  if (!key) return { full: "", error: "OPENAI_API_KEY not configured" };

  const messages: Array<{ role: string; content: string }> = [];
  if (opts.systemPrompt?.trim()) {
    messages.push({ role: "system", content: opts.systemPrompt.trim() });
  }
  messages.push({ role: "user", content: opts.prompt });

  const model = opts.model || "gpt-4o";
  const isReasoning = /^(o\d|gpt-5)/.test(model);
  const body: Record<string, unknown> = { model, messages, stream: true };
  if (isReasoning) {
    body.max_completion_tokens = opts.maxOutputTokens ?? 4096;
  } else {
    body.max_tokens = opts.maxOutputTokens ?? 2048;
    if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  }

  let res: Response;
  try {
    res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    return {
      full: "",
      error: err instanceof Error ? err.message : "network error",
    };
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    return { full: "", error: `OpenAI ${res.status}: ${text.slice(0, 300)}` };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE frames are split by blank lines. Each non-blank line is a
    // `data: {...}` (or `data: [DONE]`).
    let nl = buf.indexOf("\n");
    while (nl >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      nl = buf.indexOf("\n");
      if (!line || !line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const obj = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = obj.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        /* ignore malformed frames */
      }
    }
  }

  return { full };
}
