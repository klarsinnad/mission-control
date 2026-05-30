import { promises as fs } from "node:fs";
import path from "node:path";
import { Q_WORKSPACE_PATH } from "./config";

// ── Secret loader with workspace-.env fallback ─────────────────────
// Next.js loads .env.local from mission-control/. Aydin's keys sit one
// level up in `Agent - workspace/.env`. This helper looks there as a
// fallback so we don't have to duplicate keys.

const cache = new Map<string, string | null>();

export async function getSecret(name: string): Promise<string | null> {
  if (process.env[name]) return process.env[name]!;
  if (cache.has(name)) return cache.get(name)!;

  try {
    const raw = await fs.readFile(
      path.join(Q_WORKSPACE_PATH, ".env"),
      "utf8"
    );
    const re = new RegExp(`^${name}=(.+)$`, "m");
    const match = raw.match(re);
    const value = match ? match[1].trim().replace(/^["']|["']$/g, "") : null;
    cache.set(name, value);
    return value;
  } catch {
    cache.set(name, null);
    return null;
  }
}
