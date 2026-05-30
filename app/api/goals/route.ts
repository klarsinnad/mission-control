import { readJson, writeJson, writeNote, todayStamp } from "@/lib/obsidian";
import type { Goal } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA = ".data/goals.json";

function pct(g: Goal): number {
  if (!g.tasks.length) return 0;
  return Math.round((g.tasks.filter((t) => t.done).length / g.tasks.length) * 100);
}

/** Human-readable view for Obsidian — real checkbox task lists. */
function renderMd(goals: Goal[]): string {
  const head = `---\ntags: [agentic-os, goals]\nupdated: ${todayStamp()}\n---\n\n# 🎯 Goals\n\n`;
  if (!goals.length) return head + "_No goals yet._\n";
  const body = goals
    .map((g) => {
      const lines = [`## ${g.title} — ${pct(g)}%`];
      if (g.category) lines.push(`*${g.category}*`);
      lines.push("");
      for (const t of g.tasks) lines.push(`- [${t.done ? "x" : " "}] ${t.text}`);
      return lines.join("\n");
    })
    .join("\n\n");
  return head + body + "\n";
}

export async function GET() {
  const goals = await readJson<Goal[]>(DATA, []);
  return Response.json({ goals });
}

export async function PUT(req: Request) {
  const { goals } = (await req.json()) as { goals: Goal[] };
  if (!Array.isArray(goals)) {
    return Response.json({ ok: false, error: "goals must be an array" }, { status: 400 });
  }
  await writeJson(DATA, goals);
  await writeNote("Goals.md", renderMd(goals));
  return Response.json({ ok: true });
}
