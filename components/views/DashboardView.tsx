"use client";

import { motion } from "framer-motion";
import { Coins, Gauge, Boxes, CheckCircle2, ArrowRight, Radio } from "lucide-react";
import { useStore } from "@/lib/store";
import { StatCard } from "../StatCard";
import { AgentCard } from "../AgentCard";
import { ActivityFeed } from "../ActivityFeed";
import { Panel } from "../ui/Panel";
import { RadialGauge } from "../ui/RadialGauge";
import { Sparkline } from "../ui/Sparkline";
import { compactNumber, formatUptime } from "@/lib/format";

export function DashboardView() {
  const { metrics, agents, throughputSeries, setView } = useStore();
  const topAgents = [...agents]
    .sort((a, b) => b.load - a.load)
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-5">
      {/* Hero stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Tokens Processed"
          value={metrics.totalTokens}
          format={compactNumber}
          icon={Coins}
          color="#a78bff"
          series={throughputSeries.slice(-20)}
          delta="+12.4%"
        />
        <StatCard
          index={1}
          label="Throughput"
          value={metrics.throughput}
          format={compactNumber}
          suffix="tok/s"
          icon={Gauge}
          color="#22d3ee"
          series={throughputSeries.slice(-20)}
          delta="live"
        />
        <StatCard
          index={2}
          label="Agents Online"
          value={metrics.activeAgents}
          icon={Boxes}
          color="#34d399"
          delta={`of ${agents.length}`}
        />
        <StatCard
          index={3}
          label="Tasks Completed"
          value={metrics.tasksCompleted}
          format={compactNumber}
          icon={CheckCircle2}
          color="#fbbf24"
          delta="+38 today"
        />
      </div>

      {/* Mid row: throughput chart + vitals */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel
          title="Neural Throughput"
          subtitle="Aggregate token flow across the fleet"
          delay={0.1}
          className="lg:col-span-2"
          action={
            <span className="flex items-center gap-1.5 rounded-full bg-cyan/10 px-2.5 py-1 text-[11px] text-cyan">
              <Radio className="h-3 w-3 animate-pulse" /> streaming
            </span>
          }
        >
          <div className="relative h-48 w-full">
            <Sparkline
              data={throughputSeries}
              color="#22d3ee"
              width={760}
              height={192}
              strokeWidth={2.5}
              className="h-full w-full"
            />
            <div className="pointer-events-none absolute inset-0 grid-overlay opacity-40" />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-white/45">
            <span>
              Peak{" "}
              <span className="font-mono text-cyan">
                {compactNumber(Math.max(...throughputSeries) * 38)} tok/s
              </span>
            </span>
            <span>
              Uptime{" "}
              <span className="font-mono text-white/70">
                {formatUptime(metrics.uptimeMins)}
              </span>
            </span>
          </div>
        </Panel>

        <Panel title="Fleet Vitals" delay={0.18}>
          <div className="flex flex-col items-center">
            <RadialGauge
              value={metrics.fleetLoad}
              label={`${Math.round(metrics.fleetLoad)}%`}
              sublabel="Fleet Load"
            />
            <div className="mt-4 grid w-full grid-cols-2 gap-3">
              <Vital label="Healthy" value={`${metrics.activeAgents}`} color="#34d399" />
              <Vital
                label="Paused"
                value={`${agents.filter((a) => a.status === "paused").length}`}
                color="#64748b"
              />
              <Vital
                label="Thinking"
                value={`${agents.filter((a) => a.status === "thinking").length}`}
                color="#a78bff"
              />
              <Vital
                label="Idle"
                value={`${agents.filter((a) => a.status === "idle").length}`}
                color="#fbbf24"
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* Bottom row: agent preview + activity */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              Active Agents
            </h2>
            <button
              onClick={() => setView("agents")}
              className="flex items-center gap-1 text-xs text-violet hover:text-white"
            >
              View fleet <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {topAgents.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        </div>

        <Panel
          title="Live Activity"
          subtitle="Fleet-wide event stream"
          delay={0.2}
          action={
            <button
              onClick={() => setView("activity")}
              className="text-xs text-violet hover:text-white"
            >
              All
            </button>
          }
        >
          <ActivityFeed limit={11} />
        </Panel>
      </div>
    </div>
  );
}

function Vital({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
    >
      <div className="font-mono text-xl font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
    </motion.div>
  );
}
