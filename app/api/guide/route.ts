import { writeNote } from "@/lib/obsidian";
import { GUIDE_MD } from "@/lib/guide-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REL = "Guide.md";

const FRONTMATTER = (() => {
  const date = new Date().toLocaleDateString("sv-SE");
  return `---\ntags: [agentic-os, guide]\nupdated: ${date}\n---\n\n`;
})();

export async function GET() {
  return Response.json({ content: GUIDE_MD });
}

/** Sync the latest guide content to the vault as `Guide.md`. */
export async function POST() {
  const path = await writeNote(REL, FRONTMATTER + GUIDE_MD);
  return Response.json({ ok: true, path });
}
