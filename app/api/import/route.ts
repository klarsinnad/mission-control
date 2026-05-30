import { promises as fs } from "node:fs";
import path from "node:path";
import { Q_WORKSPACE_PATH } from "@/lib/config";
import { importChatGPT } from "@/lib/import-chatgpt";
import { importClaude } from "@/lib/import-claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── External history → vault ───────────────────────────────────────
// Pulls in your ChatGPT export (from `Open ai historik/`) and every
// Claude Code session (from `~/.claude/projects/`). Each conversation
// becomes one markdown note under `Imported/`, and Memory search picks
// them up automatically. Idempotent — re-runs only import new items.

async function findLatestChatGPTExport(): Promise<string | null> {
  const dir = path.join(Q_WORKSPACE_PATH, "Open ai historik");
  try {
    const files = await fs.readdir(dir);
    const matches = files
      .filter((f) => /chatgpt-export.*\.jsonl$/i.test(f))
      .sort()
      .reverse();
    return matches[0] ? path.join(dir, matches[0]) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const source = new URL(req.url).searchParams.get("source") || "all";
  const result: Record<string, unknown> = {};

  if (source === "all" || source === "chatgpt") {
    const file = await findLatestChatGPTExport();
    result.chatgpt = file
      ? await importChatGPT(file)
      : { error: "No ChatGPT export found in `Open ai historik/`" };
  }
  if (source === "all" || source === "claude") {
    result.claude = await importClaude();
  }

  return Response.json(result);
}

export async function GET() {
  // Status only — no work.
  const file = await findLatestChatGPTExport();
  return Response.json({
    chatgptExport: file
      ? {
          path: file,
          size: (await fs.stat(file).catch(() => null))?.size ?? null,
        }
      : null,
    claudeProjectsDir: path.join(
      process.env.HOME ?? "",
      ".claude",
      "projects"
    ),
  });
}
