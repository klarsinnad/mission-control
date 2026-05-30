import { readNote } from "@/lib/obsidian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rel = new URL(req.url).searchParams.get("path");
  if (!rel) return new Response("path required", { status: 400 });
  const text = await readNote(rel);
  if (text === null) return new Response("not found", { status: 404 });
  return new Response(text, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
