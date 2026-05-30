import { promises as fs } from "node:fs";
import path from "node:path";
import { OS_ROOT } from "./config";
import { readJson, writeJson, todayStamp } from "./obsidian";

const META_REL = ".data/studio.json";

export interface StudioImage {
  id: string;
  prompt: string;
  refinedPrompt?: string;
  refinedBy?: string;       // Q-agent name if a director was used
  agentId?: string;
  model: string;
  size: string;
  quality?: string;
  file: string;             // relative to OS_ROOT
  createdAt: number;
}

function slug(s: string, max = 40): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "image"
  );
}

/** Write a PNG buffer into the vault and append metadata. */
export async function saveStudioImage(
  meta: Omit<StudioImage, "id" | "file" | "createdAt"> & {
    pngBuffer: Buffer;
  }
): Promise<StudioImage> {
  const id = `img_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const date = todayStamp();
  const fileName = `${slug(meta.prompt)}-${Date.now()}.png`;
  const rel = path.join("Studio", date, fileName);
  const abs = path.join(OS_ROOT, rel);

  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, meta.pngBuffer);

  const entry: StudioImage = {
    id,
    prompt: meta.prompt,
    refinedPrompt: meta.refinedPrompt,
    refinedBy: meta.refinedBy,
    agentId: meta.agentId,
    model: meta.model,
    size: meta.size,
    quality: meta.quality,
    file: rel,
    createdAt: Date.now(),
  };

  const all = await readJson<StudioImage[]>(META_REL, []);
  all.unshift(entry);
  await writeJson(META_REL, all);
  return entry;
}

export async function listStudioImages(): Promise<StudioImage[]> {
  return readJson<StudioImage[]>(META_REL, []);
}

/** Read a single image file from the vault — used by the file-serve route. */
export async function readStudioFile(rel: string): Promise<Buffer | null> {
  // Allow only paths under Studio/ — no traversal.
  const safe = path
    .normalize(rel)
    .replace(/^(\.\.(\/|\\|$))+/, "")
    .replace(/^[/\\]+/, "");
  if (!safe.startsWith("Studio/") && !safe.startsWith("Studio\\")) {
    return null;
  }
  try {
    return await fs.readFile(path.join(OS_ROOT, safe));
  } catch {
    return null;
  }
}
