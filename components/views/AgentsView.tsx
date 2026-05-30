"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Pause, Play, Cpu, Clock, Coins, CheckCircle2, Plus, Radio, History } from "lucide-react";
import { useStore } from "@/lib/store";
import { AgentCard } from "../AgentCard";
import { ControlRoom } from "../ControlRoom";
import { RadialGauge } from "../ui/RadialGauge";
import { Sparkline } from "../ui/Sparkline";
import { StatusDot, STATUS_LABELS } from "../ui/StatusDot";
import { compactNumber, formatUptime } from "@/lib/format";
import type { Agent, AgentStatus } from "@/lib/types";

const FILTERS: { id: AgentStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "thinking", label: "Thinking" },
  { id: "idle", label: "Idle" },
  { id: "paused", label: "Paused" },
];

export function AgentsView() {
  const { agents, selectedAgentId, setSelectedAgentId, toggleAgent, setView } =
    useStore();
  const [filter, setFilter] = useState<AgentStatus | "all">("all");
  const [controlRoomAgent, setControlRoomAgent] = useState<Agent | null>(null);

  const filtered =
    filter === "all" ? agents : agents.filter((a) => a.status === filter);
  const selected = agents.find((a) => a.id === selectedAgentId) ?? null;

  return (
    <div className="relative">
      {/* filter bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count =
            f.id === "all"
              ? agents.length
              : agents.filter((a) => a.status === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                active
                  ? "border-violet/50 bg-violet/15 text-white"
                  : "border-white/10 text-white/50 hover:text-white"
              }`}
            >
              {f.label}
              <span className="ml-1.5 font-mono text-white/35">{count}</span>
            </button>
          );
        })}
        <div className="flex-1" />
        <button className="glass glass-hover flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs text-white/70">
          <Plus className="h-3.5 w-3.5" /> Deploy agent
        </button>
      </div>

      <motion.div layout className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence>
          {filtered.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAgentId(null)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              className="glass fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-base font-semibold"
                    style={{
                      background: `${selected.accent}1f`,
                      border: `1px solid ${selected.accent}55`,
                      color: selected.accent,
                    }}
                  >
                    {selected.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {selected.name}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
                      <StatusDot status={selected.status} />
                      {STATUS_LABELS[selected.status]} · {selected.codename}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgentId(null)}
                  className="glass-hover flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 flex items-center justify-center">
                <RadialGauge
                  value={selected.load}
                  size={160}
                  color={selected.accent}
                  label={`${Math.round(selected.load)}%`}
                  sublabel="Load"
                />
              </div>

              <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Current Task
                </div>
                <p className="mt-1 text-sm text-white/75">{selected.task}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric icon={Cpu} label="Model" value={selected.model} mono />
                <Metric
                  icon={Clock}
                  label="Uptime"
                  value={formatUptime(selected.uptimeMins)}
                />
                <Metric
                  icon={Coins}
                  label="Tokens"
                  value={compactNumber(selected.tokens)}
                />
                <Metric
                  icon={CheckCircle2}
                  label="Completed"
                  value={compactNumber(selected.completed)}
                />
              </div>

              <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Activity (last 32 ticks)
                </div>
                <Sparkline
                  data={selected.series}
                  color={selected.accent}
                  width={400}
                  height={64}
                  className="w-full"
                />
              </div>

              <div className="mt-auto flex gap-3 pt-6">
                {selected.id === "antigravity" ? (
                  // Antigravity isn't a chat target — it's the host. Send the
                  // operator to the dedicated Sessions surface instead.
                  <button
                    onClick={() => {
                      setView("sessions");
                      setSelectedAgentId(null);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                    style={{
                      background: `linear-gradient(135deg, ${selected.accent}, #22d3ee)`,
                      boxShadow: `0 0 24px ${selected.accent}55`,
                    }}
                  >
                    <History className="h-4 w-4" /> Open Sessions
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setControlRoomAgent(selected);
                        setSelectedAgentId(null);
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                      style={{
                        background: `linear-gradient(135deg, ${selected.accent}, #22d3ee)`,
                        boxShadow: `0 0 24px ${selected.accent}55`,
                      }}
                    >
                      <Radio className="h-4 w-4" /> Open Control Room
                    </button>
                    <button
                      onClick={() => toggleAgent(selected.id)}
                      className="glass glass-hover flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white"
                      title={selected.status === "paused" ? "Resume agent" : "Pause agent"}
                    >
                      {selected.status === "paused" ? (
                        <Play className="h-4 w-4" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ControlRoom
        agent={controlRoomAgent}
        onClose={() => setControlRoomAgent(null)}
      />
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-white/40">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div
        className={`mt-1 text-sm text-white ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
