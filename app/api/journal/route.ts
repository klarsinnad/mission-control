import {
  readJson,
  writeJson,
  writeNote,
  listNotes,
  todayStamp,
} from "@/lib/obsidian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const dataRel = (date: string) => `.data/journal/${date}.json`;
const mdRel = (date: string) => `Journal/${date}.md`;

function renderMd(date: string, content: string): string {
  return `---\ndate: ${date}\ntags: [agentic-os, journal]\n---\n\n# 📓 Journal — ${date}\n\n${content.trim()}\n`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayStamp();
  if (!dateRe.test(date)) {
    return Response.json({ error: "bad date" }, { status: 400 });
  }
  const { content } = await readJson<{ content: string }>(dataRel(date), {
    content: "",
  });
  const files = await listNotes("Journal");
  const dates = files
    .map((f) => f.replace(/^Journal[/\\]/, "").replace(/\.md$/, ""))
    .filter((d) => dateRe.test(d))
    .sort()
    .reverse();
  return Response.json({ date, content, dates });
}

export async function PUT(req: Request) {
  const { date, content } = (await req.json()) as {
    date: string;
    content: string;
  };
  if (!dateRe.test(date)) {
    return Response.json({ ok: false, error: "bad date" }, { status: 400 });
  }
  await writeJson(dataRel(date), { content: content ?? "" });
  await writeNote(mdRel(date), renderMd(date, content ?? ""));
  return Response.json({ ok: true });
}
