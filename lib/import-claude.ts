import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeNote, readJson, writeJson } from "./obsidian";

const MANIFEST = ".data/imported-manifest.json";

interface ClaudeEntry {
  path: string;
  mtime: number;
}

interface Manifest {
  chatgpt: Record<string, string>;
  // Legacy entries are bare strings (path only, no mtime). New entries
  // are objects so we can detect when the source jsonl has grown since
  // the last import.
  claude: Record<string, string | ClaudeEntry>;
}

function manifestPathOf(entry: string | ClaudeEntry | undefined): string | undefined {
  if (!entry) return undefined;
  return typeof entry === "string" ? entry : entry.path;
}

function manifestMtimeOf(entry: string | ClaudeEntry | undefined): number {
  if (!entry || typeof entry === "string") return 0;
  return entry.mtime ?? 0;
}

interface ClaudeEvent {
  type?: string;
  timestamp?: string;
  title?: string;
  message?: {
    role?: string;
    content?: unknown;
  };
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (b): b is { type: string; text: string } =>
          !!b && typeof b === "object" && "type" in b && "text" in b
      )
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

function renderSession(
  sessionId: string,
  projectSlug: string,
  events: ClaudeEvent[]
): { md: string; date: string; title: string } {
  const aiTitle = events.find((e) => e.type === "ai-title")?.title;
  const firstUser = events.find((e) => e.type === "user");
  const userText = firstUser ? extractText(firstUser.message?.content) : "";
  const title =
    aiTitle?.trim() ||
    userText.split("\n")[0]?.trim().slice(0, 80) ||
    "Untitled session";

  const firstTs = events.find((e) => e.timestamp)?.timestamp ?? "";
  const date = firstTs ? firstTs.slice(0, 10) : "0000-00-00";

  let body = `---\nsource: claude-code\ntitle: ${JSON.stringify(title)}\nsession_id: ${sessionId}\nproject: ${projectSlug}\ndate: ${date}\ntags: [agentic-os, imported, claude-code]\n---\n\n# ${title}\n\n*Imported from Claude Code session · ${date} · ${sessionId.slice(0, 8)}*\n\n`;

  for (const e of events) {
    if (e.type !== "user" && e.type !== "assistant") continue;
    const text = extractText(e.message?.content);
    if (!text.trim()) continue;
    const label = e.type === "user" ? "**Operator:**" : "**Claude:**";
    body += `${label}\n\n${text.trim()}\n\n---\n\n`;
  }

  return { md: body, date, title };
}

function prettyProjectSlug(s: string): string {
  // Decode the Claude Code project naming: leading - and -- separator.
  return s.replace(/^-+/, "").replace(/---/g, " · ").slice(0, 80);
}

export async function importClaude(): Promise<{
  imported: number;
  skipped: number;
  total: number;
}> {
  const projectsDir = path.join(os.homedir(), ".claude", "projects");
  const manifest = await readJson<Manifest>(MANIFEST, {
    chatgpt: {},
    claude: {},
  });

  let imported = 0;
  let skipped = 0;
  let total = 0;

  let projects;
  try {
    projects = await fs.readdir(projectsDir, { withFileTypes: true });
  } catch {
    return { imported, skipped, total };
  }

  for (const proj of projects) {
    if (!proj.isDirectory()) continue;
    const projDir = path.join(projectsDir, proj.name);
    let files: string[];
    try {
      files = await fs.readdir(projDir);
    } catch {
      continue;
    }
    const projectLabel = prettyProjectSlug(proj.name);

    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      const sessionId = file.replace(/\.jsonl$/, "");
      total++;

      const absJsonl = path.join(projDir, file);
      let currentMtime = 0;
      try {
        currentMtime = (await fs.stat(absJsonl)).mtimeMs;
      } catch {
        continue;
      }

      const existing = manifest.claude[sessionId];
      if (existing && currentMtime <= manifestMtimeOf(existing)) {
        // No new events since last import — skip.
        skipped++;
        continue;
      }

      let raw: string;
      try {
        raw = await fs.readFile(absJsonl, "utf8");
      } catch {
        continue;
      }
      const events: ClaudeEvent[] = [];
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          events.push(JSON.parse(line) as ClaudeEvent);
        } catch {
          /* ignore parse errors per line */
        }
      }
      if (!events.length) continue;

      const { md, date } = renderSession(sessionId, projectLabel, events);
      // Reuse the path if we already know it (e.g. legacy entry); else
      // build a new path. Keeping the same file means Obsidian backlinks
      // and external links don't break across re-imports.
      const rel =
        manifestPathOf(existing) ??
        path.join(
          "Imported",
          "Claude",
          proj.name,
          `${date}-${sessionId.slice(0, 8)}.md`
        );
      try {
        await writeNote(rel, md);
        manifest.claude[sessionId] = { path: rel, mtime: currentMtime };
        imported++;
      } catch {
        /* skip on write error */
      }
    }
  }

  await writeJson(MANIFEST, manifest);
  return { imported, skipped, total };
}
