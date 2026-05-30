import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

// ── Hermes Agent CLI bridge ────────────────────────────────────────
// `hermes -z` is the non-interactive (one-shot) mode. We pin to a
// provider+model pair per call. The system prompt isn't a flag in the
// CLI, so we splice the agent manifest into the prompt itself.

const HERMES_BIN =
  process.env.HERMES_CLI_PATH ||
  path.join(os.homedir(), ".local", "bin", "hermes");

export interface HermesRunOptions {
  prompt: string;
  systemPrompt?: string;
  provider?: string;  // "copilot" | "openai" | "openrouter" | "google" | …
  model?: string;     // depends on provider
  timeoutMs?: number;
}

export async function runHermes(
  opts: HermesRunOptions
): Promise<{ text: string; error?: string }> {
  const provider = opts.provider || "copilot";
  const model = opts.model || "gpt-4o";

  const args: string[] = ["-z", buildPrompt(opts.prompt, opts.systemPrompt), "--provider", provider, "-m", model];

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(HERMES_BIN, args, { cwd: os.tmpdir(), env: process.env });
    } catch (err) {
      resolve({
        text: "",
        error: err instanceof Error ? err.message : "spawn failed",
      });
      return;
    }
    let out = "";
    let errBuf = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (errBuf += d.toString()));
    const timer = setTimeout(() => {
      try { child.kill("SIGTERM"); } catch { /* noop */ }
    }, opts.timeoutMs ?? 180_000);

    child.on("close", () => {
      clearTimeout(timer);
      const text = out.trim();
      if (text) resolve({ text });
      else resolve({ text: "", error: errBuf.trim() || "empty result" });
    });
  });
}

/**
 * Hermes `-z` doesn't accept --system; we splice the persona before the
 * user message so the model sees both as a single prompt.
 */
function buildPrompt(user: string, system?: string): string {
  if (!system) return user;
  return `# Persona / system context\n\n${system.trim()}\n\n---\n\n# User request\n\n${user.trim()}`;
}

/** Status probe used by Settings. */
export async function hermesStatus(): Promise<{
  available: boolean;
  version?: string;
  binary: string;
}> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(HERMES_BIN, ["--version"], { env: process.env });
    } catch {
      resolve({ available: false, binary: HERMES_BIN });
      return;
    }
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.on("error", () => resolve({ available: false, binary: HERMES_BIN }));
    child.on("close", (code) =>
      resolve({
        available: code === 0,
        version: code === 0 ? out.trim().split("\n")[0] : undefined,
        binary: HERMES_BIN,
      })
    );
    setTimeout(() => {
      try { child.kill("SIGTERM"); } catch { /* noop */ }
      resolve({ available: false, binary: HERMES_BIN });
    }, 3000);
  });
}
