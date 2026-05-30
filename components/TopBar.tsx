"use client";

import { useEffect, useState } from "react";
import { Command, Search, Wifi, WifiOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import { compactNumber } from "@/lib/format";

const TITLES: Record<string, { title: string; sub: string }> = {
  dashboard: { title: "Overview", sub: "Live fleet telemetry" },
  agents: { title: "Agent Fleet", sub: "Orchestrate your agents" },
  console: { title: "Claude Console", sub: "Direct line to Claude" },
  goals: { title: "Goals", sub: "Set targets · track momentum" },
  journal: { title: "Journal", sub: "One entry a day, in your vault" },
  memory: { title: "Memory", sub: "Search everything your AI has saved" },
  tasks: { title: "Tasks", sub: "Delegate · execute · save the result" },
  studio: { title: "Studio", sub: "Generate images · directed by a Q-agent" },
  workspace: { title: "Workspace", sub: "Every artefact you've ever made" },
  sessions: { title: "Sessions", sub: "Every Antigravity / Claude Code session, searchable" },
  seo: { title: "SEO Studio", sub: "Keyword in · article out · Kangaroo-ready" },
  activity: { title: "Activity Stream", sub: "Everything, as it happens" },
  guide: { title: "Guide", sub: "How this was built · share with anyone" },
  settings: { title: "Settings", sub: "System configuration" },
};

export function TopBar() {
  const { view, setPaletteOpen, metrics } = useStore();
  const [now, setNow] = useState<Date | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const check = () =>
      fetch("/api/health")
        .then((r) => r.json())
        .then((d) => setConnected(!!d.connected))
        .catch(() => setConnected(false));
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, []);

  const meta = TITLES[view] ?? TITLES.dashboard;

  return (
    <header className="relative z-20 flex items-center gap-4 px-6 py-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-white">
          {meta.title}
        </h1>
        <p className="text-xs text-white/40">{meta.sub}</p>
      </div>

      <div className="flex-1" />

      {/* quick stats */}
      <div className="hidden items-center gap-5 lg:flex">
        <Stat
          label="Tokens"
          value={<AnimatedNumber value={metrics.totalTokens} format={compactNumber} />}
          color="#a78bff"
        />
        <Stat
          label="Throughput"
          value={
            <>
              <AnimatedNumber value={metrics.throughput} format={compactNumber} />
              <span className="text-white/30">/s</span>
            </>
          }
          color="#22d3ee"
        />
        <Stat label="Online" value={`${metrics.activeAgents}`} color="#34d399" />
      </div>

      {/* connection pill */}
      <div
        className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
        style={{
          borderColor:
            connected === false
              ? "rgba(251,113,133,0.4)"
              : "rgba(52,211,153,0.4)",
          background:
            connected === false
              ? "rgba(251,113,133,0.08)"
              : "rgba(52,211,153,0.08)",
        }}
      >
        {connected === false ? (
          <WifiOff className="h-3.5 w-3.5 text-rose" />
        ) : (
          <Wifi className="h-3.5 w-3.5 text-emerald" />
        )}
        <span
          className={connected === false ? "text-rose" : "text-emerald"}
        >
          {connected === null
            ? "Linking…"
            : connected
            ? "Claude linked · CLI"
            : "Claude offline"}
        </span>
      </div>

      {/* clock */}
      <div className="hidden font-mono text-sm tabular-nums text-white/70 md:block">
        {now
          ? now.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "--:--:--"}
      </div>

      {/* command palette trigger */}
      <button
        onClick={() => setPaletteOpen(true)}
        className="glass glass-hover flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/55"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-1 hidden items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50 sm:flex">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>
    </header>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: React.ReactNode;
  color: string;
}) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">
        {label}
      </div>
      <div
        className="font-mono text-sm font-semibold tabular-nums"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}
