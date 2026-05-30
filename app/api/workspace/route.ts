import { promises as fs } from "node:fs";
import path from "node:path";
import { OS_ROOT } from "@/lib/config";
import { readJson, listNotes } from "@/lib/obsidian";
import type { Task, Goal } from "@/lib/types";
import type { StudioImage } from "@/lib/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Workspace feed: every artefact in the vault, unified ───────────
// Aggregates Tasks, Studio images, Daily Summaries, Journal entries,
// Imported ChatGPT/Claude history, and Control Room agent chats. Each
// item normalizes to { id, type, title, subtitle, date, file?, thumb? }.

export type WsType =
  | "task"
  | "image"
  | "summary"
  | "journal"
  | "chat"
  | "agent-chat"
  | "imported-chatgpt"
  | "imported-claude";

export interface WsItem {
  id: string;
  type: WsType;
  title: string;
  subtitle?: string;
  date: string;      // ISO YYYY-MM-DD
  ts: number;        // for sorting
  file?: string;     // relative to OS_ROOT
  thumbUrl?: string; // direct img src
  badge?: string;    // status / agent name / etc
  badgeColor?: string;
}

async function fileMtime(rel: string): Promise<number> {
  try {
    const st = await fs.stat(path.join(OS_ROOT, rel));
    return st.mtimeMs;
  } catch {
    return 0;
  }
}

function dateFromFilename(rel: string): string {
  const m = rel.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "0000-00-00";
}

function pct(g: Goal): number {
  if (!g.tasks.length) return 0;
  return Math.round((g.tasks.filter((t) => t.done).length / g.tasks.length) * 100);
}

export async function GET() {
  const items: WsItem[] = [];

  // Tasks
  const tasks = await readJson<Task[]>(".data/tasks.json", []);
  for (const t of tasks) {
    items.push({
      id: `task-${t.id}`,
      type: "task",
      title: t.title,
      subtitle: t.description.split("\n")[0]?.slice(0, 140),
      date: new Date(t.createdAt).toLocaleDateString("sv-SE"),
      ts: t.createdAt,
      badge: t.agentName ?? t.status,
      badgeColor:
        t.status === "done"
          ? "#34d399"
          : t.status === "failed"
          ? "#fb7185"
          : "#a78bff",
    });
  }

  // Studio images
  const images = await readJson<StudioImage[]>(".data/studio.json", []);
  for (const img of images) {
    items.push({
      id: `img-${img.id}`,
      type: "image",
      title: img.prompt.slice(0, 80),
      subtitle: `${img.model} · ${img.size}`,
      date: new Date(img.createdAt).toLocaleDateString("sv-SE"),
      ts: img.createdAt,
      file: img.file,
      thumbUrl: `/api/studio/file?path=${encodeURIComponent(img.file)}`,
      badge: img.refinedBy,
      badgeColor: "#e879f9",
    });
  }

  // Daily summaries
  const summaries = (await listNotes("Daily Summary")).filter((f) => f.endsWith(".md"));
  for (const f of summaries) {
    const date = dateFromFilename(f);
    items.push({
      id: `sum-${f}`,
      type: "summary",
      title: `Daily Summary · ${date}`,
      date,
      ts: await fileMtime(f),
      file: f,
      badge: "retro",
      badgeColor: "#22d3ee",
    });
  }

  // Journal
  const journal = (await listNotes("Journal")).filter((f) => f.endsWith(".md"));
  for (const f of journal) {
    const date = dateFromFilename(f);
    items.push({
      id: `jour-${f}`,
      type: "journal",
      title: `Journal · ${date}`,
      date,
      ts: await fileMtime(f),
      file: f,
      badgeColor: "#34d399",
    });
  }

  // Console chats
  const chats = (await listNotes("Chats")).filter((f) => f.endsWith(".md"));
  for (const f of chats) {
    const date = dateFromFilename(f);
    items.push({
      id: `chat-${f}`,
      type: "chat",
      title: `Console · ${date}`,
      date,
      ts: await fileMtime(f),
      file: f,
      badgeColor: "#a78bff",
    });
  }

  // Per-agent control room chats
  const agentChats = (await listNotes("Agents")).filter((f) => f.endsWith(".md"));
  for (const f of agentChats) {
    const parts = f.split(/[/\\]/);
    const agent = parts[1] ?? "agent";
    const date = dateFromFilename(f);
    items.push({
      id: `ac-${f}`,
      type: "agent-chat",
      title: `Control Room · ${agent}`,
      subtitle: date,
      date,
      ts: await fileMtime(f),
      file: f,
      badge: agent,
      badgeColor: "#fb7185",
    });
  }

  // Imported (just counts via listNotes — heavy to enumerate every conversation here)
  const importedGpt = (await listNotes("Imported/ChatGPT")).filter((f) => f.endsWith(".md"));
  const importedClaude = (await listNotes("Imported/Claude")).filter((f) => f.endsWith(".md"));
  // Surface the 30 most recent of each
  const mostRecent = async (files: string[], take: number) => {
    const withTs = await Promise.all(
      files.map(async (f) => ({ f, ts: await fileMtime(f), date: dateFromFilename(f) }))
    );
    return withTs.sort((a, b) => b.ts - a.ts).slice(0, take);
  };
  for (const { f, ts, date } of await mostRecent(importedGpt, 30)) {
    const base = f.split(/[/\\]/).pop()?.replace(/\.md$/, "") ?? f;
    items.push({
      id: `igpt-${f}`,
      type: "imported-chatgpt",
      title: base.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " "),
      subtitle: date,
      date,
      ts,
      file: f,
      badge: "ChatGPT",
      badgeColor: "#10a37f",
    });
  }
  for (const { f, ts, date } of await mostRecent(importedClaude, 30)) {
    const base = f.split(/[/\\]/).pop()?.replace(/\.md$/, "") ?? f;
    items.push({
      id: `iclaude-${f}`,
      type: "imported-claude",
      title: base.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " "),
      subtitle: date,
      date,
      ts,
      file: f,
      badge: "Claude",
      badgeColor: "#cc785c",
    });
  }

  items.sort((a, b) => b.ts - a.ts);

  // Aggregate counts for the tab bar
  const counts: Record<WsType, number> = {
    task: 0, image: 0, summary: 0, journal: 0, chat: 0,
    "agent-chat": 0, "imported-chatgpt": importedGpt.length,
    "imported-claude": importedClaude.length,
  };
  for (const it of items) {
    if (it.type !== "imported-chatgpt" && it.type !== "imported-claude") {
      counts[it.type]++;
    }
  }

  return Response.json({ items: items.slice(0, 250), counts });
}
