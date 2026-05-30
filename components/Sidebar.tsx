"use client";

import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Boxes,
  Terminal,
  Activity,
  Settings,
  Hexagon,
  Target,
  BookOpen,
  Brain,
  BookText,
  ListTodo,
  Image as ImageIcon,
  Briefcase,
  Search as SearchIcon,
  History,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { ViewId } from "@/lib/types";

const NAV: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "agents", label: "Agent Fleet", icon: Boxes },
  { id: "console", label: "Claude Console", icon: Terminal },
  { id: "goals", label: "Goals", icon: Target },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "studio", label: "Studio", icon: ImageIcon },
  { id: "workspace", label: "Workspace", icon: Briefcase },
  { id: "sessions", label: "Sessions", icon: History },
  { id: "seo", label: "SEO", icon: SearchIcon },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "guide", label: "Guide", icon: BookText },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { view, setView, metrics } = useStore();

  return (
    <aside className="relative z-20 flex w-[248px] shrink-0 flex-col gap-2 px-4 py-5">
      {/* Brand */}
      <div className="mb-4 flex items-center gap-3 px-2">
        <div className="relative flex h-10 w-10 items-center justify-center">
          <Hexagon
            className="animate-spin-slow absolute h-10 w-10 text-violet/70"
            strokeWidth={1}
          />
          <div className="h-2.5 w-2.5 rounded-full bg-violet shadow-[0_0_16px_#a78bff]" />
        </div>
        <div className="leading-tight">
          <div className="font-mono text-[13px] font-semibold tracking-[0.18em] text-white">
            MISSION<span className="text-violet"> CONTROL</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/35">
            Claude OS
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
            >
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="glass absolute inset-0 rounded-xl"
                  style={{
                    border: "1px solid rgba(139,123,255,0.4)",
                    boxShadow: "0 0 24px rgba(139,123,255,0.18) inset",
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon
                className={`relative z-10 h-[18px] w-[18px] transition-colors ${
                  active
                    ? "text-violet"
                    : "text-white/45 group-hover:text-white/80"
                }`}
                strokeWidth={2}
              />
              <span
                className={`relative z-10 transition-colors ${
                  active
                    ? "font-medium text-white"
                    : "text-white/55 group-hover:text-white/90"
                }`}
              >
                {label}
              </span>
              {active && (
                <span className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-violet shadow-[0_0_10px_#a78bff]" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Fleet load mini-readout */}
      <div className="glass edge-light rounded-xl p-3.5">
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
          <span>Fleet Load</span>
          <span className="font-mono text-emerald">
            {Math.round(metrics.fleetLoad)}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg,#a78bff,#22d3ee)",
              boxShadow: "0 0 12px rgba(139,123,255,0.6)",
            }}
            animate={{ width: `${metrics.fleetLoad}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 16 }}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[10px] text-white/35">
          <span>{metrics.activeAgents} agents online</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald" />
            nominal
          </span>
        </div>
      </div>
    </aside>
  );
}
