import { promises as fs } from "node:fs";
import path from "node:path";
import { writeNote, readJson, writeJson } from "./obsidian";

const MANIFEST = ".data/imported-manifest.json";

interface Manifest {
  chatgpt: Record<string, string>;
  claude: Record<string, string>;
}

interface ChatGPTNode {
  parent?: string | null;
  children?: string[];
  message?: {
    author?: { role?: string };
    content?: { parts?: unknown[]; content_type?: string };
    create_time?: number;
  };
}

interface ChatGPTConv {
  title?: string;
  create_time?: number;
  conversation_id?: string;
  current_node?: string;
  mapping?: Record<string, ChatGPTNode>;
}

function slug(s: string, max = 60): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "untitled"
  );
}

function epochToDate(t?: number): string {
  if (!t) return "0000-00-00";
  const d = new Date(t * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function extractParts(parts: unknown[] = []): string {
  return parts
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object" && "text" in p)
        return String((p as { text?: string }).text ?? "");
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function walkThread(conv: ChatGPTConv): ChatGPTNode[] {
  const mapping = conv.mapping ?? {};
  const out: ChatGPTNode[] = [];
  let cur: string | null | undefined = conv.current_node;
  // Guard against cycles in case of malformed data.
  const seen = new Set<string>();
  while (cur && mapping[cur] && !seen.has(cur)) {
    seen.add(cur);
    out.unshift(mapping[cur]);
    cur = mapping[cur].parent ?? null;
  }
  return out;
}

function render(conv: ChatGPTConv): string {
  const title = conv.title?.trim() || "Untitled conversation";
  const date = epochToDate(conv.create_time);
  const id = conv.conversation_id ?? "?";
  const thread = walkThread(conv);

  let body = `---\nsource: chatgpt\ntitle: ${JSON.stringify(title)}\ndate: ${date}\nconversation_id: ${id}\ntags: [agentic-os, imported, chatgpt]\n---\n\n# ${title}\n\n*Imported from ChatGPT export · ${date}*\n\n`;

  for (const node of thread) {
    const msg = node.message;
    if (!msg) continue;
    const role = msg.author?.role;
    if (!role || role === "system" || role === "tool") continue;
    const text = extractParts(msg.content?.parts);
    if (!text) continue;
    const label =
      role === "user" ? "**You:**" : role === "assistant" ? "**ChatGPT:**" : `**${role}:**`;
    body += `${label}\n\n${text}\n\n---\n\n`;
  }
  return body;
}

export async function importChatGPT(
  jsonlPath: string
): Promise<{ imported: number; skipped: number; total: number }> {
  let raw: string;
  try {
    raw = await fs.readFile(jsonlPath, "utf8");
  } catch {
    return { imported: 0, skipped: 0, total: 0 };
  }

  const manifest = await readJson<Manifest>(MANIFEST, { chatgpt: {}, claude: {} });
  let imported = 0;
  let skipped = 0;
  let total = 0;

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    total++;
    let conv: ChatGPTConv;
    try {
      conv = JSON.parse(line) as ChatGPTConv;
    } catch {
      continue;
    }
    const id = conv.conversation_id;
    if (!id) continue;
    if (manifest.chatgpt[id]) {
      skipped++;
      continue;
    }

    const date = epochToDate(conv.create_time);
    const month = date.slice(0, 7);
    const fileName = `${date}-${slug(conv.title ?? "")}.md`;
    const rel = path.join("Imported", "ChatGPT", month, fileName);

    try {
      await writeNote(rel, render(conv));
      manifest.chatgpt[id] = rel;
      imported++;
    } catch {
      // skip on write error
    }
  }

  await writeJson(MANIFEST, manifest);
  return { imported, skipped, total };
}
