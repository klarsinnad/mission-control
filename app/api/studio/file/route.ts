import { readStudioFile } from "@/lib/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rel = new URL(req.url).searchParams.get("path");
  if (!rel) return new Response("path required", { status: 400 });
  const buf = await readStudioFile(rel);
  if (!buf) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
