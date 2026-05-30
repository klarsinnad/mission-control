"use client";

import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { ActivityFeed } from "../ActivityFeed";
import { Panel } from "../ui/Panel";
import { Sparkline } from "../ui/Sparkline";

export function ActivityView() {
  const { activity, agents, throughputSeries } = useStore();

  const byLevel = {
    success: activity.filter((e) => e.level === "success").length,
    info: activity.filter((e) => e.level === "info").length,
    thinking: activity.filter((e) => e.level === "thinking").length,
    warn: activity.filter((e) => e.level === "warn" || e.level === "error").length,
  };

  const counters = [
    { label: "Success", value: byLevel.success, color: "#34d399" },
    { label: "Info", value: byLevel.info, color: "#60a5fa" },
    { label: "Thinking", value: byLevel.thinking, color: "#a78bff" },
    { label: "Warnings", value: byLevel.warn, color: "#fbbf24" },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Panel title="Event Stream" subtitle={`${activity.length} events buffered`}>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
            <ActivityFeed limit={50} />
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-5">
        <Panel title="Signal Breakdown" delay={0.1}>
          <div className="grid grid-cols-2 gap-3">
            {counters.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
              >
                <div
                  className="font-mono text-2xl font-semibold"
                  style={{ color: c.color }}
                >
                  {c.value}
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                  {c.label}
                </div>
              </motion.div>
            ))}
          </div>
        </Panel>

        <Panel title="Fleet Pulse" delay={0.18}>
          <div className="h-24">
            <Sparkline
              data={throughputSeries}
              color="#22d3ee"
              width={320}
              height={96}
              className="h-full w-full"
            />
          </div>
          <div className="mt-3 space-y-2">
            {agents.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="w-24 truncate text-xs text-white/55">
                  {a.name}
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${a.load}%`,
                      background: a.accent,
                    }}
                  />
                </div>
                <span
                  className="w-9 text-right font-mono text-[11px]"
                  style={{ color: a.accent }}
                >
                  {Math.round(a.load)}%
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
