import { promises as fs } from "node:fs";
import path from "node:path";
import { OS_ROOT } from "./config";

// ── Obsidian vault write/read layer ────────────────────────────────
// The vault is just a folder of markdown files on disk, so we write to
// it directly — no plugin, no "Obsidian must be open". Everything lives
// under <vault>/<OS_FOLDER>/.

/** Strip any path-traversal so a relative note path can't escape OS_ROOT. */
function safeRel(rel: string): string {
  return path
    .normalize(rel)
    .replace(/^(\.\.(\/|\\|$))+/, "")
    .replace(/^[/\\]+/, "");
}

export function osPath(...segments: string[]): string {
  return path.join(OS_ROOT, ...segments.map(safeRel));
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeNote(rel: string, content: string): Promise<string> {
  const abs = osPath(rel);
  await ensureDir(path.dirname(abs));
  await fs.writeFile(abs, content, "utf8");
  return abs;
}

/** Append to a note, creating it (with `header`) on first write. */
export async function appendNote(
  rel: string,
  content: string,
  header = ""
): Promise<string> {
  const abs = osPath(rel);
  await ensureDir(path.dirname(abs));
  let exists = true;
  try {
    await fs.access(abs);
  } catch {
    exists = false;
  }
  if (!exists && header) await fs.writeFile(abs, header, "utf8");
  await fs.appendFile(abs, content, "utf8");
  return abs;
}

export async function readNote(rel: string): Promise<string | null> {
  try {
    return await fs.readFile(osPath(rel), "utf8");
  } catch {
    return null;
  }
}

/** List `.md` files (relative to OS_ROOT) under an optional subfolder. */
export async function listNotes(subdir = ""): Promise<string[]> {
  const out: string[] = [];
  async function walk(abs: string, rel: string) {
    let entries;
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const childAbs = path.join(abs, e.name);
      const childRel = rel ? path.join(rel, e.name) : e.name;
      if (e.isDirectory()) await walk(childAbs, childRel);
      else if (e.name.endsWith(".md")) out.push(childRel);
    }
  }
  await walk(osPath(subdir), subdir);
  return out.sort();
}

// ── Date helpers (local time) ──────────────────────────────────────

/** YYYY-MM-DD in local time. */
export function todayStamp(d = new Date()): string {
  return d.toLocaleDateString("sv-SE"); // ISO-style: 2026-05-29
}
/** HH:MM in local time. */
export function timeStamp(d = new Date()): string {
  return d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

// ── JSON source-of-truth helpers (kept in <OS_FOLDER>/.data) ───────
// `.data` starts with a dot, so Obsidian's file explorer ignores it —
// the human-readable .md renders live alongside it.

export async function readJson<T>(rel: string, fallback: T): Promise<T> {
  const raw = await readNote(rel);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(rel: string, data: unknown): Promise<void> {
  await writeNote(rel, JSON.stringify(data, null, 2));
}

// ── Domain writers ─────────────────────────────────────────────────

/** Append one Console exchange to today's chat log. */
export async function appendChat(
  user: string,
  assistant: string,
  model: string
): Promise<void> {
  const date = todayStamp();
  const rel = path.join("Chats", `${date}.md`);
  const header = `---\ndate: ${date}\ntags: [agentic-os, chat]\n---\n\n# Claude Console — ${date}\n\n`;
  const entry =
    `## ${timeStamp()} · ${model}\n\n` +
    `**Operator:**\n${user.trim()}\n\n` +
    `**Mission Control:**\n${assistant.trim()}\n\n---\n\n`;
  await appendNote(rel, entry, header);
}

/** Append one Control Room exchange under a specific agent's folder. */
export async function appendAgentChat(
  agentName: string,
  user: string,
  assistant: string,
  model: string
): Promise<void> {
  const date = todayStamp();
  const safe = agentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const rel = path.join("Agents", safe, `${date}.md`);
  const header = `---\nagent: ${agentName}\ndate: ${date}\ntags: [agentic-os, agent-chat, ${safe}]\n---\n\n# ${agentName} · Control Room — ${date}\n\n`;
  const entry =
    `## ${timeStamp()} · ${model}\n\n` +
    `**Operator:**\n${user.trim()}\n\n` +
    `**${agentName}:**\n${assistant.trim()}\n\n---\n\n`;
  await appendNote(rel, entry, header);
}
