"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Agent, ActivityEvent, ViewId, ChatMessage } from "./types";
import { SEED_AGENTS, seedActivity, randomEvent } from "./data";

interface Metrics {
  totalTokens: number;
  activeAgents: number;
  fleetLoad: number; // avg 0-100
  throughput: number; // tokens/sec, live
  tasksCompleted: number;
  uptimeMins: number;
}

interface Store {
  agents: Agent[];
  activity: ActivityEvent[];
  metrics: Metrics;
  throughputSeries: number[];
  view: ViewId;
  setView: (v: ViewId) => void;
  paletteOpen: boolean;
  setPaletteOpen: (b: boolean) => void;
  toggleAgent: (id: string) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  booted: boolean;
  chat: ChatMessage[];
  setChat: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used within StoreProvider");
  return v;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(SEED_AGENTS);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [view, setView] = useState<ViewId>("dashboard");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [throughputSeries, setThroughputSeries] = useState<number[]>(
    Array.from({ length: 40 }, (_, i) => 50 + Math.sin(i * 0.4) * 20)
  );
  const [booted, setBooted] = useState(false);

  // Seed activity on mount (client-only to avoid hydration mismatch)
  useEffect(() => {
    setActivity(seedActivity(SEED_AGENTS, 16));
    const t = setTimeout(() => setBooted(true), 2200);
    return () => clearTimeout(t);
  }, []);

  // Replace the seed with the real Q agent roster.
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.agents) && d.agents.length) {
          setAgents(d.agents as Agent[]);
          setActivity(seedActivity(d.agents as Agent[], 16));
        }
      })
      .catch(() => {
        /* fall back to SEED_AGENTS */
      });
  }, []);

  // Live tick — agent loads, token accrual, sparklines
  useEffect(() => {
    const id = setInterval(() => {
      setAgents((prev) =>
        prev.map((a) => {
          if (a.status === "paused") return a;
          const drift = (Math.random() - 0.45) * 14;
          const load = Math.max(4, Math.min(99, a.load + drift));
          const next = [...a.series.slice(1), Math.round(load)];
          const burn = a.status === "thinking" ? 2600 : 900;
          return {
            ...a,
            load,
            series: next,
            tokens: a.tokens + Math.round(Math.random() * burn),
            uptimeMins: a.uptimeMins + 0.05,
          };
        })
      );
      setThroughputSeries((prev) => {
        const last = prev[prev.length - 1] ?? 50;
        const v = Math.max(8, Math.min(100, last + (Math.random() - 0.5) * 26));
        return [...prev.slice(1), v];
      });
    }, 1400);
    return () => clearInterval(id);
  }, []);

  // Occasionally push a new activity event
  useEffect(() => {
    const id = setInterval(() => {
      setActivity((prev) => [randomEvent(agents), ...prev].slice(0, 60));
    }, 3800);
    return () => clearInterval(id);
  }, [agents]);

  // Global keyboard: ⌘K / Ctrl-K palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleAgent(id: string) {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id
          ? a.status === "paused"
            ? {
                ...a,
                status: "active",
                load: 30 + Math.random() * 30,
                task: "Resuming · re-entering work loop",
              }
            : { ...a, status: "paused", load: 0, task: "Paused by operator" }
          : a
      )
    );
  }

  const metrics: Metrics = useMemo(() => {
    const active = agents.filter((a) => a.status !== "paused");
    const fleetLoad =
      active.length === 0
        ? 0
        : active.reduce((s, a) => s + a.load, 0) / active.length;
    return {
      totalTokens: agents.reduce((s, a) => s + a.tokens, 0),
      activeAgents: active.length,
      fleetLoad,
      throughput: Math.round(
        (throughputSeries[throughputSeries.length - 1] ?? 0) * 38
      ),
      tasksCompleted: agents.reduce((s, a) => s + a.completed, 0),
      uptimeMins: Math.max(...agents.map((a) => a.uptimeMins)),
    };
  }, [agents, throughputSeries]);

  const value: Store = {
    agents,
    activity,
    metrics,
    throughputSeries,
    view,
    setView,
    paletteOpen,
    setPaletteOpen,
    toggleAgent,
    selectedAgentId,
    setSelectedAgentId,
    booted,
    chat,
    setChat,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
