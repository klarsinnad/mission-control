import { listNotes, readNote } from "@/lib/obsidian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface SearchHit {
  file: string; // relative to OS folder, e.g. "Chats/2026-05-29.md"
  line: number;
  text: string;
}

// Searches your AI's memory — everything Agentic OS has written to the
// vault (chats, goals, journal). Case-insensitive substring over lines.
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim().toLowerCase();
  if (q.length < 2) return Response.json({ hits: [], count: 0 });

  const files = await listNotes();
  const hits: SearchHit[] = [];
  const MAX = 120;

  for (const f of files) {
    const content = await readNote(f);
    if (!content) continue;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes(q)) {
        const text = line.replace(/^[#>\-*\s]+/, "").trim();
        if (text) hits.push({ file: f, line: i + 1, text: text.slice(0, 220) });
        if (hits.length >= MAX) break;
      }
    }
    if (hits.length >= MAX) break;
  }

  return Response.json({ hits, count: hits.length });
}
