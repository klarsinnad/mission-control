"use client";

import { motion } from "framer-motion";
import { Pause, Play, Cpu, CheckCircle2 } from "lucide-react";
import type { Agent } from "@/lib/types";
import { StatusDot } from "./ui/StatusDot";
import { Sparkline } from "./ui/Sparkline";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import { compactNumber } from "@/lib/format";
import { useStore } from "@/lib/store";

const KIND_LABEL: Record<string, string> = {
  orchestrator: "Orchestrator",
  researcher: "Researcher",
  coder: "Engineer",
  analyst: "Analyst",
  guardian: "Guardian",
  scribe: "Scribe",
};

export function AgentCard({ agent }: { agent: Agent }) {
  const { toggleAgent, setSelectedAgentId, setView } = useStore();
  const paused = agent.status === "paused";

  return (
    <motion.div
      layout
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      onClick={() => {
        setSelectedAgentId(agent.id);
        setView("agents");
      }}
      role="button"
      tabIndex={0}
      className="glass glass-hover edge-light group relative cursor-pointer overflow-hidden rounded-2xl p-5"
    >
      {/* accent glow */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-70"
        style={{ background: agent.accent }}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold"
            style={{
              background: `${agent.accent}1f`,
              border: `1px solid ${agent.accent}55`,
              color: agent.accent,
              boxShadow: `0 0 20px ${agent.accent}22`,
            }}
          >
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{agent.name}</span>
              <StatusDot status={agent.status} />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              {agent.codename} · {KIND_LABEL[agent.kind]}
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleAgent(agent.id);
          }}
          className="glass-hover flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 hover:text-white"
          title={paused ? "Resume agent" : "Pause agent"}
        >
          {paused ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* task */}
      <p className="relative mt-4 line-clamp-2 min-h-[2.5rem] text-sm leading-snug text-white/60">
        {agent.task}
      </p>

      {/* sparkline */}
      <div className="relative mt-3 h-9">
        <Sparkline
          data={agent.series}
          color={agent.accent}
          width={260}
          height={36}
          className="w-full"
        />
      </div>

      {/* load bar */}
      <div className="relative mt-3">
        <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/35">
          <span>Load</span>
          <span className="font-mono" style={{ color: agent.accent }}>
            {Math.round(agent.load)}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${agent.accent}, #22d3ee)`,
            }}
            animate={{ width: `${agent.load}%` }}
            transition={{ type: "spring", stiffness: 70, damping: 18 }}
          />
        </div>
      </div>

      {/* footer stats */}
      <div className="relative mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-white/45">
        <span className="flex items-center gap-1.5" title="Model">
          <Cpu className="h-3.5 w-3.5" />
          <span className="font-mono">{agent.model}</span>
        </span>
        <span className="flex items-center gap-1.5" title="Tasks completed">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <AnimatedNumber value={agent.completed} format={compactNumber} />
        </span>
      </div>
    </motion.div>
  );
}
