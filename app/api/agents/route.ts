import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { Q_WORKSPACE_PATH } from "@/lib/config";
import type { Agent, AgentKind, AgentStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Real Q agent fleet ─────────────────────────────────────────────
// Reads agents/roster.json + each agent's manifest .md from the Q
// workspace and shapes them into the dashboard's Agent type. The agent
// list is now ground truth, not seed data.

interface RosterEntry {
  id: string;
  name: string;
  manifest?: string;
  model: string; // "claude-opus" | "claude-sonnet" | "claude-haiku"
  status?: string;
  skills?: string[];
  hired?: string; // YYYY-MM-DD
}

const MODEL_MAP: Record<string, string> = {
  "claude-opus": "claude-opus-4-7",
  "claude-sonnet": "claude-sonnet-4-6",
  "claude-haiku": "claude-haiku-4-5",
};

// Color palette assigned per-index for visual variety.
const ACCENTS = [
  "#a78bff", "#22d3ee", "#34d399", "#fbbf24",
  "#fb7185", "#e879f9", "#60a5fa", "#2dd4bf",
  "#f472b6", "#a3e635", "#fb923c", "#818cf8",
  "#f87171", "#facc15",
];

function kindFor(name: string, skills: string[] = []): AgentKind {
  const n = name.toLowerCase();
  const s = skills.join(" ").toLowerCase();
  if (/worker|forge|deploy|content|coding/.test(n + " " + s)) return "coder";
  if (/memory|archivist|formatter|scribe|index/.test(n + " " + s)) return "scribe";
  if (/watchdog|guard|security|sentinel/.test(n + " " + s)) return "guardian";
  if (/scout|research/.test(n + " " + s)) return "researcher";
  if (/controll|router|skill|retro|orchestr/.test(n + " " + s)) return "orchestrator";
  return "analyst";
}

function codenameFor(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "·").replace(/^·|·$/g, "");
}

function noise(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}
function makeSeries(seed: number): number[] {
  const out: number[] = [];
  let v = 38 + ((seed * 7) % 30);
  for (let i = 0; i < 32; i++) {
    v += Math.sin(i * 0.6 + seed) * 9 + noise(i + seed * 100) * 12;
    v = Math.max(6, Math.min(98, v));
    out.push(Math.round(v));
  }
  return out;
}

function uptimeMinutes(hired?: string): number {
  if (!hired) return 0;
  const d = new Date(hired + "T12:00:00");
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
}

function normalizeStatus(s?: string): AgentStatus {
  switch (s) {
    case "active":
    case "thinking":
    case "idle":
    case "paused":
    case "error":
      return s;
    default:
      return "active";
  }
}

/**
 * Pull a one-line role description from the manifest. Q manifests are in
 * Swedish and use a `## Roll` section — prefer that. Falls back to the
 * first prose paragraph (skipping frontmatter, headings, hr lines, etc.).
 */
async function readRole(rel: string): Promise<string> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(Q_WORKSPACE_PATH, rel), "utf8");
  } catch {
    return "";
  }

  // Prefer the "## Roll" / "## Role" section if present.
  const sectionRe = /^##\s*(?:Roll|Role)\s*$([\s\S]+?)(?=^##\s|^#\s|\Z)/im;
  const match = raw.match(sectionRe);
  if (match) {
    const first = match[1]
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !/^[-*_]{3,}$/.test(l));
    if (first) return first.replace(/^[-*]\s*/, "").slice(0, 180);
  }

  // Fallback: first prose paragraph anywhere, with frontmatter toggles.
  let inFrontmatter = false;
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (t === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;
    if (!t) continue;
    if (t.startsWith("#") || t.startsWith(">") || t.startsWith("```") || t.startsWith("|")) continue;
    if (/^[-*_]{3,}$/.test(t)) continue;
    return t.replace(/^[-*]\s*/, "").slice(0, 180);
  }
  return "";
}

async function loadAgents(): Promise<Agent[]> {
  const rosterPath = path.join(Q_WORKSPACE_PATH, "agents/roster.json");
  let roster: { agents: RosterEntry[] };
  try {
    roster = JSON.parse(await fs.readFile(rosterPath, "utf8"));
  } catch {
    return [];
  }
  return Promise.all(
    roster.agents.map(async (r, i): Promise<Agent> => {
      const role = r.manifest ? await readRole(r.manifest) : "";
      const skills = r.skills ?? [];
      const accent = ACCENTS[i % ACCENTS.length];
      const status = normalizeStatus(r.status);
      const idSeed = i + 1;
      const baseLoad = status === "paused" ? 0 : 24 + ((idSeed * 13) % 56);
      return {
        id: r.id,
        name: r.name,
        codename: codenameFor(r.id),
        kind: kindFor(r.name, skills),
        model: MODEL_MAP[r.model] || r.model,
        status,
        load: baseLoad,
        completed: 120 + ((idSeed * 73) % 1800),
        tokens: 80_000 + ((idSeed * 1373) % 2_400_000),
        task: role || (skills.length ? `Skills · ${skills.join(", ")}` : "Standing by"),
        uptimeMins: uptimeMinutes(r.hired),
        accent,
        series: makeSeries(idSeed),
      };
    })
  );
}

/**
 * Synthesize an "Antigravity" card from real Claude Code session activity.
 * Not a Q-agent — it's the IDE / runtime that hosts our Claude Code
 * conversations. Status reflects how recent the latest session jsonl was
 * touched: live → thinking, recent → active, otherwise → idle.
 */
async function antigravityCard(): Promise<Agent | null> {
  const projectsDir = path.join(os.homedir(), ".claude", "projects");
  let total = 0;
  let mostRecentMtime = 0;
  let latestProjectSlug = "";
  try {
    const projects = await fs.readdir(projectsDir, { withFileTypes: true });
    for (const p of projects) {
      if (!p.isDirectory()) continue;
      const projDir = path.join(projectsDir, p.name);
      let files: string[];
      try {
        files = await fs.readdir(projDir);
      } catch {
        continue;
      }
      for (const f of files) {
        if (!f.endsWith(".jsonl")) continue;
        total++;
        try {
          const st = await fs.stat(path.join(projDir, f));
          if (st.mtimeMs > mostRecentMtime) {
            mostRecentMtime = st.mtimeMs;
            latestProjectSlug = p.name;
          }
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    return null;
  }
  if (total === 0) return null;

  const ageMs = Date.now() - mostRecentMtime;
  const ageMins = Math.round(ageMs / 60000);
  const status: AgentStatus =
    ageMs < 5 * 60 * 1000
      ? "thinking"
      : ageMs < 30 * 60 * 1000
      ? "active"
      : "idle";

  const latestProject = latestProjectSlug
    .replace(/^-+/, "")
    .replace(/---/g, " · ")
    .slice(0, 40);
  const task =
    status === "thinking"
      ? "Aktiv session pågår just nu"
      : status === "active"
      ? `Senaste session: ${ageMins}m sedan i ${latestProject}`
      : ageMins < 1440
      ? `Senaste aktivitet ${Math.round(ageMins / 60)}h sedan`
      : `Inaktiv i ${Math.round(ageMins / 1440)} dagar`;

  return {
    id: "antigravity",
    name: "Antigravity",
    codename: "ANTIGRAVITY · IDE",
    kind: "researcher",
    model: "claude-code · subscription",
    status,
    load: status === "thinking" ? 72 : status === "active" ? 38 : 9,
    completed: total,
    tokens: 0,
    task,
    uptimeMins: 0,
    accent: "#10b981", // emerald — distinct from the Q-agent palette
    series: makeSeries(99),
  };
}

export async function GET() {
  const agents = await loadAgents();
  const ag = await antigravityCard();
  if (ag) agents.unshift(ag); // surface Antigravity first
  return Response.json({ agents, count: agents.length });
}
