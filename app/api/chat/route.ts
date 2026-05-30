import { spawn } from "node:child_process";
import os from "node:os";
import { appendChat, appendAgentChat } from "@/lib/obsidian";
import { buildAgentSystemPrompt } from "@/lib/q-agents";
import { streamOpenAI } from "@/lib/openai-chat";
import { runHermes } from "@/lib/hermes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Claude Code CLI bridge ──────────────────────────────────────────
// Instead of the Anthropic API (per-token billing + an API key), this
// route shells out to the local `claude` CLI. That uses your logged-in
// Claude subscription — no API key, no per-token bills. The browser only
// ever sees plain-text chunks; the CLI session never touches the client.

const CLAUDE_BIN = process.env.CLAUDE_CLI_PATH || "claude";

const SYSTEM_PROMPT = `You are Claude, operating as the core intelligence of "Mission Control" — a locally-hosted command center for orchestrating an AI agent fleet. You speak with the operator directly through the Claude Console.

Be sharp, warm, and concise. Use markdown when it helps (headers, lists, code blocks). When asked about the fleet, agents, or system, answer in-character as the orchestrating intelligence. Default to clarity over length. You are reached through the operator's own Claude subscription via the local CLI — there is no API key and no per-message billing.`;

const VALID_MODELS = new Set([
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
]);

interface IncomingMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * `claude -p` is one-shot, so we render the prior conversation into the
 * prompt as context and end with the operator's latest message.
 */
function buildPrompt(messages: IncomingMessage[]): string {
  const convo = messages.filter(
    (m) => m.role !== "system" && typeof m.content === "string" && m.content.trim()
  );
  if (convo.length === 0) return "";
  const last = convo[convo.length - 1];
  const prior = convo.slice(0, -1);
  if (prior.length === 0) return last.content;

  const transcript = prior
    .map(
      (m) =>
        `${m.role === "user" ? "Operator" : "Mission Control"}: ${m.content}`
    )
    .join("\n\n");

  return `# Conversation so far\n${transcript}\n\n# Operator's latest message\n${last.content}`;
}

export async function POST(req: Request) {
  const { messages, model, agentId, provider, hermesProvider } =
    (await req.json()) as {
      messages: IncomingMessage[];
      model?: string;
      agentId?: string;
      provider?: "claude" | "openai" | "hermes";
      hermesProvider?: string;
    };

  const chosenProvider: "claude" | "openai" | "hermes" =
    provider === "openai" ? "openai" : provider === "hermes" ? "hermes" : "claude";

  const chosenModel =
    typeof model === "string" && model.trim()
      ? model
      : chosenProvider === "claude"
      ? process.env.CLAUDE_MODEL || "claude-sonnet-4-6"
      : "gpt-4o";

  // For Claude, lock to validated models; other providers manage their own model namespace.
  if (chosenProvider === "claude" && !VALID_MODELS.has(chosenModel)) {
    // fall back to default rather than error — picker UI sends valid options
  }

  // Agent Control Room mode: scope Claude to that agent's manifest.
  let systemPromptText = SYSTEM_PROMPT;
  let agentName: string | null = null;
  if (typeof agentId === "string" && agentId.trim()) {
    const a = await buildAgentSystemPrompt(agentId.trim());
    if (a) {
      systemPromptText = a.prompt;
      agentName = a.name;
    }
  }

  const prompt = buildPrompt(messages ?? []);
  const lastUser =
    (messages ?? []).filter((m) => m.role === "user").pop()?.content ?? "";
  const encoder = new TextEncoder();

  if (!prompt) {
    return new Response("Tell me what you need and I'll pick it up.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // ── Provider: OpenAI (streaming via SSE) ─────────────────────────
  if (chosenProvider === "openai") {
    const stream = new ReadableStream({
      async start(controller) {
        let full = "";
        const { error } = await streamOpenAI(
          { prompt, systemPrompt: systemPromptText, model: chosenModel },
          (chunk) => {
            full += chunk;
            controller.enqueue(encoder.encode(chunk));
          },
          req.signal
        );
        if (!full && error) {
          controller.enqueue(encoder.encode(`\n\n⚠️ OpenAI error: ${error}`));
        }
        controller.close();
        if (full && lastUser) {
          const save = agentName
            ? appendAgentChat(agentName, lastUser, full, chosenModel)
            : appendChat(lastUser, full, chosenModel);
          save.catch(() => {});
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Mission-Mode": "openai",
      },
    });
  }

  // ── Provider: Hermes (non-streaming, full text at end) ───────────
  if (chosenProvider === "hermes") {
    const stream = new ReadableStream({
      async start(controller) {
        const { text, error } = await runHermes({
          prompt,
          systemPrompt: systemPromptText,
          provider: hermesProvider || "copilot",
          model: chosenModel,
        });
        if (text) controller.enqueue(encoder.encode(text));
        else
          controller.enqueue(
            encoder.encode(`\n\n⚠️ Hermes error: ${error || "empty"}`)
          );
        controller.close();
        if (text && lastUser) {
          const save = agentName
            ? appendAgentChat(agentName, lastUser, text, `hermes/${chosenModel}`)
            : appendChat(lastUser, text, `hermes/${chosenModel}`);
          save.catch(() => {});
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Mission-Mode": "hermes",
      },
    });
  }

  // ── Provider: Claude (default) — existing CLI path below ─────────

  // Force the subscription/OAuth path — never accidentally bill an API key.
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;

  const stream = new ReadableStream({
    start(controller) {
      let child;
      try {
        child = spawn(
          CLAUDE_BIN,
          [
            "-p",
            prompt,
            "--output-format",
            "stream-json",
            "--include-partial-messages",
            "--verbose",
            "--model",
            chosenModel,
            "--system-prompt",
            systemPromptText,
          ],
          { cwd: os.tmpdir(), env }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "spawn failed";
        controller.enqueue(
          encoder.encode(`\n\n⚠️ Could not start the Claude CLI: ${msg}`)
        );
        controller.close();
        return;
      }

      let buf = "";
      let sawText = false;
      let resultText = "";
      let streamedText = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        buf += chunk.toString();
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let evt: { type?: string; event?: { type?: string; delta?: { type?: string; text?: string } }; result?: string };
          try {
            evt = JSON.parse(line);
          } catch {
            continue; // ignore non-JSON noise
          }
          if (evt.type === "stream_event") {
            const inner = evt.event;
            if (
              inner?.type === "content_block_delta" &&
              inner.delta?.type === "text_delta" &&
              inner.delta.text
            ) {
              sawText = true;
              streamedText += inner.delta.text;
              controller.enqueue(encoder.encode(inner.delta.text));
            }
          } else if (evt.type === "result" && typeof evt.result === "string") {
            resultText = evt.result;
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("error", (err: Error) => {
        controller.enqueue(
          encoder.encode(
            `\n\n⚠️ Claude CLI error: ${err.message}. Is \`claude\` on the server's PATH?`
          )
        );
        controller.close();
      });

      child.on("close", (code: number | null) => {
        // Partials disabled / no deltas seen → flush the final result text.
        if (!sawText && resultText) {
          controller.enqueue(encoder.encode(resultText));
        }
        if (!sawText && !resultText) {
          const detail = stderr.trim().slice(0, 400) || `exit code ${code}`;
          controller.enqueue(
            encoder.encode(
              `\n\n⚠️ No response from Claude CLI (${detail}). If this says you're not logged in, run \`claude\` once in a terminal to authenticate.`
            )
          );
        }
        controller.close();

        // Persist the exchange to the vault (fire-and-forget; never blocks).
        const assistant = streamedText || resultText;
        if (assistant && lastUser) {
          const save = agentName
            ? appendAgentChat(agentName, lastUser, assistant, chosenModel)
            : appendChat(lastUser, assistant, chosenModel);
          save.catch(() => {
            /* vault unavailable — don't crash the stream */
          });
        }
      });

      // Client hit Stop / navigated away → kill the CLI process.
      const signal = req.signal;
      if (signal) {
        const onAbort = () => {
          child.kill("SIGTERM");
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Mission-Mode": "cli",
    },
  });
}
