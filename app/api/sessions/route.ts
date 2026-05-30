import { promises as fs } from "node:fs";
import path from "node:path";
import { OS_ROOT } from "@/lib/config";
import { listNotes } from "@/lib/obsidian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Claude Code session listing ────────────────────────────────────
// Reads every `.md` under Imported/Claude/<project>/ in the vault and
// returns rich metadata for the Sessions view. The vault files were
// produced by lib/import-claude.ts from ~/.claude/projects/<slug>/*.jsonl,
// so this view is one step downstream from the launchd-driven re-import.

export interface SessionItem {
  file: string;          // path relative to OS_ROOT
  sessionId: string;     // first 8 chars of original jsonl uuid
  project: string;       // pretty project label
  projectSlug: string;   // raw folder name (matches ~/.claude/projects/)
  date: string;          // YYYY-MM-DD from frontmatter
  ts: number;            // mtime in ms (for sorting)
  title: string;         // first user message or "Untitled"
  turns: number;         // rough count of operator messages
  size: number;          // file size in bytes
  preview: string;       // snippet from the first operator message
}

function prettyProject(slug: string): string {
  return slug.replace(/^-+/, "").replace(/---/g, " · ").slice(0, 80) || slug;
}

function parseFrontmatter(raw: string): Record<string, string> {
  if (!raw.startsWith("---")) return {};
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return {};
  const block = raw.slice(4, end);
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "").trim();
  }
  return out;
}

/** Pull the first operator message body and turn count from a rendered session note. */
function digestBody(raw: string): { firstUser: string; turns: number } {
  // Strip frontmatter.
  let body = raw;
  if (body.startsWith("---")) {
    const end = body.indexOf("\n---", 3);
    if (end > 0) body = body.slice(end + 4);
  }
  // Count operator turns.
  const turns = (body.match(/\*\*Operator:\*\*/g) || []).length;
  // Extract first operator message — between **Operator:** and the next ---
  const m = body.match(/\*\*Operator:\*\*\s*\n([\s\S]+?)\n\s*---/);
  const firstUser = m ? m[1].trim() : "";
  return { firstUser, turns };
}

export async function GET() {
  const files = (await listNotes("Imported/Claude")).filter((f) =>
    f.endsWith(".md")
  );

  const items: SessionItem[] = [];
  for (const f of files) {
    const abs = path.join(OS_ROOT, f);
    let stat;
    try {
      stat = await fs.stat(abs);
    } catch {
      continue;
    }
    let raw: string;
    try {
      raw = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(raw);
    const { firstUser, turns } = digestBody(raw);

    // Project: parse out from the relative path Imported/Claude/<slug>/<file>.md
    const parts = f.split(/[/\\]/);
    const projectSlug = parts[2] || "unknown";
    const project = prettyProject(projectSlug);
    const fileName = parts[parts.length - 1] || f;
    const sessionId = fileName.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");

    // Title preference: first user msg (truncated) > frontmatter title > fallback
    const cleanFirst = firstUser
      .replace(/[#>\-*]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
    const title = cleanFirst || fm.title || "Untitled session";

    items.push({
      file: f,
      sessionId,
      project,
      projectSlug,
      date: fm.date || "0000-00-00",
      ts: stat.mtimeMs,
      title,
      turns,
      size: stat.size,
      preview: cleanFirst.slice(0, 180),
    });
  }

  items.sort((a, b) => b.ts - a.ts);

  // Project counts for the filter pill bar.
  const projectCounts: Record<string, { label: string; count: number }> = {};
  for (const it of items) {
    if (!projectCounts[it.projectSlug]) {
      projectCounts[it.projectSlug] = { label: it.project, count: 0 };
    }
    projectCounts[it.projectSlug].count++;
  }

  return Response.json({
    sessions: items,
    projects: projectCounts,
    total: items.length,
  });
}
