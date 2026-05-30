import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLAUDE_BIN = process.env.CLAUDE_CLI_PATH || "claude";

/** Is the local `claude` CLI present and runnable? Returns its version, or null. */
function cliVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(CLAUDE_BIN, ["--version"]);
    } catch {
      resolve(null);
      return;
    }
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.on("error", () => resolve(null));
    child.on("close", (code) => resolve(code === 0 ? out.trim() : null));
    // Don't hang the health check.
    setTimeout(() => {
      child.kill("SIGTERM");
      resolve(out.trim() || null);
    }, 4000);
  });
}

export async function GET() {
  const version = await cliVersion();
  const connected = !!version;
  return Response.json({
    connected,
    mode: connected ? "cli" : "offline",
    defaultModel: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6",
    cli: { available: connected, version },
  });
}
