import type { Agent, ActivityEvent, EventLevel } from "./types";

// Deterministic pseudo-noise so SSR and client hydrate identically
// (Math.random() here would cause a hydration mismatch).
function noise(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x) - 0.5; // -0.5 .. 0.5
}

function series(seed: number): number[] {
  const out: number[] = [];
  let v = 40 + (seed % 30);
  for (let i = 0; i < 32; i++) {
    v += Math.sin(i * 0.6 + seed) * 9 + noise(i + seed * 100) * 12;
    v = Math.max(6, Math.min(98, v));
    out.push(Math.round(v));
  }
  return out;
}

export const SEED_AGENTS: Agent[] = [
  {
    id: "q-core",
    name: "Q",
    codename: "NULLPOINT",
    kind: "orchestrator",
    model: "claude-opus-4-7",
    status: "active",
    load: 62,
    completed: 1487,
    tokens: 2_410_000,
    task: "Routing fleet · holding center of the torus",
    uptimeMins: 4821,
    accent: "#a78bff",
    series: series(1),
  },
  {
    id: "router",
    name: "Router",
    codename: "SWITCHBOARD",
    kind: "orchestrator",
    model: "claude-sonnet-4-6",
    status: "thinking",
    load: 78,
    completed: 932,
    tokens: 1_120_000,
    task: "Dispatching block → worker class runtimes",
    uptimeMins: 3110,
    accent: "#22d3ee",
    series: series(2),
  },
  {
    id: "context-guard",
    name: "Context Guard",
    codename: "WATCHTOWER",
    kind: "guardian",
    model: "claude-haiku-4-5",
    status: "active",
    load: 34,
    completed: 2044,
    tokens: 640_000,
    task: "Monitoring context windows · pruning drift",
    uptimeMins: 5402,
    accent: "#34d399",
    series: series(3),
  },
  {
    id: "memory-architect",
    name: "Memory Architect",
    codename: "LOOMKEEPER",
    kind: "scribe",
    model: "claude-sonnet-4-6",
    status: "idle",
    load: 12,
    completed: 611,
    tokens: 880_000,
    task: "Idle · awaiting distillation batch",
    uptimeMins: 2890,
    accent: "#fbbf24",
    series: series(4),
  },
  {
    id: "forge",
    name: "Forge",
    codename: "ANVIL",
    kind: "coder",
    model: "claude-opus-4-7",
    status: "thinking",
    load: 91,
    completed: 378,
    tokens: 1_960_000,
    task: "Building Kangaroo deploy pipeline",
    uptimeMins: 760,
    accent: "#fb7185",
    series: series(5),
  },
  {
    id: "scout",
    name: "Scout",
    codename: "LONGSIGHT",
    kind: "researcher",
    model: "claude-sonnet-4-6",
    status: "active",
    load: 47,
    completed: 1203,
    tokens: 1_410_000,
    task: "Scanning peptide literature · 14 sources",
    uptimeMins: 1980,
    accent: "#e879f9",
    series: series(6),
  },
  {
    id: "ledger",
    name: "Ledger",
    codename: "ABACUS",
    kind: "analyst",
    model: "claude-haiku-4-5",
    status: "active",
    load: 28,
    completed: 845,
    tokens: 520_000,
    task: "Reconciling B2C price matrix · 3× markup",
    uptimeMins: 4100,
    accent: "#60a5fa",
    series: series(7),
  },
  {
    id: "sentinel",
    name: "Sentinel",
    codename: "AEGIS",
    kind: "guardian",
    model: "claude-haiku-4-5",
    status: "paused",
    load: 0,
    completed: 290,
    tokens: 140_000,
    task: "Paused · security sweep on standby",
    uptimeMins: 0,
    accent: "#94a3b8",
    series: series(8),
  },
];

const VERBS: Record<string, string[]> = {
  orchestrator: [
    "routed task to {t}",
    "opened work block",
    "verified handoff with {t}",
    "rebalanced fleet load",
  ],
  researcher: [
    "indexed 6 new sources",
    "extracted 14 findings",
    "cross-referenced citations",
    "summarized literature batch",
  ],
  coder: [
    "committed patch to main",
    "ran build · passed",
    "refactored module",
    "deployed to preview",
  ],
  analyst: [
    "reconciled price matrix",
    "flagged margin anomaly",
    "computed 3× markup",
    "exported report",
  ],
  guardian: [
    "pruned context drift",
    "blocked unsafe edit",
    "verified scope boundary",
    "ran security sweep",
  ],
  scribe: [
    "distilled 12 conversations",
    "wrote memory shard",
    "linked related notes",
    "updated handoff log",
  ],
};

const LEVELS: EventLevel[] = [
  "info",
  "success",
  "info",
  "thinking",
  "success",
  "warn",
];

export function seedActivity(agents: Agent[], count = 14): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const a = agents[Math.floor(Math.random() * agents.length)];
    const verbs = VERBS[a.kind];
    const target = agents[Math.floor(Math.random() * agents.length)];
    const msg = verbs[Math.floor(Math.random() * verbs.length)].replace(
      "{t}",
      target.name
    );
    out.push({
      id: `evt-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      ts: now - i * (45_000 + Math.random() * 90_000),
      agentId: a.id,
      agentName: a.name,
      level: LEVELS[Math.floor(Math.random() * LEVELS.length)],
      message: msg,
    });
  }
  return out.sort((x, y) => y.ts - x.ts);
}

export function randomEvent(agents: Agent[]): ActivityEvent {
  const live = agents.filter((a) => a.status !== "paused");
  const a = live[Math.floor(Math.random() * live.length)] ?? agents[0];
  const verbs = VERBS[a.kind];
  const target = agents[Math.floor(Math.random() * agents.length)];
  const msg = verbs[Math.floor(Math.random() * verbs.length)].replace(
    "{t}",
    target.name
  );
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    agentId: a.id,
    agentName: a.name,
    level: LEVELS[Math.floor(Math.random() * LEVELS.length)],
    message: msg,
  };
}
