import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import {
  VAULT_PATH,
  OS_FOLDER,
  OS_ROOT,
  Q_WORKSPACE_PATH,
} from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Live config + tool auto-detection ──────────────────────────────
// Returns everything Settings needs to render: which paths are active,
// which tools are installed, whether each path actually exists.

interface ToolStatus {
  name: string;
  installed: boolean;
  path?: string;
  version?: string;
}

function tool(bin: string, args: string[] = ["--version"]): Promise<ToolStatus> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, args);
    } catch {
      resolve({ name: bin, installed: false });
      return;
    }
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (out += d.toString()));
    child.on("error", () => resolve({ name: bin, installed: false }));
    child.on("close", (code) =>
      resolve({
        name: bin,
        installed: code === 0,
        version: code === 0 ? out.trim().split("\n")[0] : undefined,
      })
    );
    setTimeout(() => {
      try { child.kill("SIGTERM"); } catch {}
      resolve({ name: bin, installed: false });
    }, 3000);
  });
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readAgentCount(): Promise<number> {
  try {
    const raw = await fs.readFile(
      path.join(Q_WORKSPACE_PATH, "agents/roster.json"),
      "utf8"
    );
    const j = JSON.parse(raw);
    return Array.isArray(j.agents) ? j.agents.length : 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const hermesBin =
    process.env.HERMES_CLI_PATH ||
    path.join(os.homedir(), ".local", "bin", "hermes");
  const [claude, openclaw, hermes, vaultOk, qOk, osOk, agents] =
    await Promise.all([
      tool(process.env.CLAUDE_CLI_PATH || "claude"),
      tool("openclaw", ["--version"]),
      tool(hermesBin, ["--version"]),
      pathExists(VAULT_PATH),
      pathExists(Q_WORKSPACE_PATH),
      pathExists(OS_ROOT),
      readAgentCount(),
    ]);

  return Response.json({
    paths: {
      vault: VAULT_PATH,
      vaultExists: vaultOk,
      osFolder: OS_FOLDER,
      osRoot: OS_ROOT,
      osRootExists: osOk,
      qWorkspace: Q_WORKSPACE_PATH,
      qWorkspaceExists: qOk,
    },
    overrides: {
      // Which paths are coming from env (vs the default).
      OBSIDIAN_VAULT_PATH: !!process.env.OBSIDIAN_VAULT_PATH,
      AGENTIC_OS_FOLDER: !!process.env.AGENTIC_OS_FOLDER,
      Q_WORKSPACE_PATH: !!process.env.Q_WORKSPACE_PATH,
      CLAUDE_CLI_PATH: !!process.env.CLAUDE_CLI_PATH,
      CLAUDE_MODEL: !!process.env.CLAUDE_MODEL,
    },
    defaultModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
    tools: { claude, openclaw, hermes },
    agentsInRoster: agents,
  });
}
