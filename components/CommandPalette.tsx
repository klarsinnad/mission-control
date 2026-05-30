"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  Boxes,
  Terminal,
  Activity,
  Settings,
  Target,
  BookOpen,
  Brain,
  BookText,
  ListTodo,
  Image as ImageIcon,
  Briefcase,
  History,
  Pause,
  Play,
  CornerDownLeft,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { ViewId } from "@/lib/types";

interface Cmd {
  id: string;
  label: string;
  hint: string;
  icon: typeof Search;
  run: () => void;
  group: string;
}

export function CommandPalette() {
  const {
    paletteOpen,
    setPaletteOpen,
    setView,
    agents,
    toggleAgent,
    setSelectedAgentId,
  } = useStore();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Cmd[] = useMemo(() => {
    const nav: { id: ViewId; label: string; icon: typeof Search }[] = [
      { id: "dashboard", label: "Go to Overview", icon: LayoutDashboard },
      { id: "agents", label: "Go to Agent Fleet", icon: Boxes },
      { id: "console", label: "Open Claude Console", icon: Terminal },
      { id: "goals", label: "Go to Goals", icon: Target },
      { id: "journal", label: "Go to Journal", icon: BookOpen },
      { id: "memory", label: "Search Memory", icon: Brain },
      { id: "tasks", label: "Go to Tasks", icon: ListTodo },
      { id: "studio", label: "Open Studio", icon: ImageIcon },
      { id: "workspace", label: "Open Workspace", icon: Briefcase },
      { id: "sessions", label: "Browse Antigravity Sessions", icon: History },
      { id: "seo", label: "Open SEO Studio", icon: Search },
      { id: "activity", label: "Go to Activity", icon: Activity },
      { id: "guide", label: "Read the Guide", icon: BookText },
      { id: "settings", label: "Go to Settings", icon: Settings },
    ];
    const navCmds: Cmd[] = nav.map((n) => ({
      id: `nav-${n.id}`,
      label: n.label,
      hint: "Navigate",
      icon: n.icon,
      group: "Navigation",
      run: () => {
        setView(n.id);
        setPaletteOpen(false);
      },
    }));
    const agentCmds: Cmd[] = agents.map((a) => ({
      id: `agent-${a.id}`,
      label: `${a.status === "paused" ? "Resume" : "Pause"} ${a.name}`,
      hint: a.codename,
      icon: a.status === "paused" ? Play : Pause,
      group: "Agents",
      run: () => {
        toggleAgent(a.id);
        setPaletteOpen(false);
      },
    }));
    const inspectCmds: Cmd[] = agents.map((a) => ({
      id: `inspect-${a.id}`,
      label: `Inspect ${a.name}`,
      hint: a.codename,
      icon: Boxes,
      group: "Agents",
      run: () => {
        setSelectedAgentId(a.id);
        setView("agents");
        setPaletteOpen(false);
      },
    }));
    return [...navCmds, ...agentCmds, ...inspectCmds];
  }, [agents, setView, setPaletteOpen, toggleAgent, setSelectedAgentId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(term) ||
        c.hint.toLowerCase().includes(term)
    );
  }, [q, commands]);

  useEffect(() => {
    if (paletteOpen) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [paletteOpen]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  }

  let lastGroup = "";

  return (
    <AnimatePresence>
      {paletteOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-[14vh] backdrop-blur-md"
          onClick={() => setPaletteOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="glass edge-light w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
          >
            <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3.5">
              <Search className="h-4 w-4 text-white/40" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search commands, agents, views…"
                className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/30 focus:outline-none"
              />
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/40">
                ESC
              </kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-white/35">
                  No commands match “{q}”
                </div>
              )}
              {filtered.map((c, i) => {
                const showGroup = c.group !== lastGroup;
                lastGroup = c.group;
                const Icon = c.icon;
                const isActive = i === active;
                return (
                  <div key={c.id}>
                    {showGroup && (
                      <div className="px-3 pb-1 pt-3 text-[10px] uppercase tracking-[0.2em] text-white/30">
                        {c.group}
                      </div>
                    )}
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => c.run()}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        isActive ? "bg-violet/15" : "hover:bg-white/5"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${
                          isActive ? "text-violet" : "text-white/45"
                        }`}
                      />
                      <span className={isActive ? "text-white" : "text-white/75"}>
                        {c.label}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-white/30">
                        {c.hint}
                      </span>
                      {isActive && (
                        <CornerDownLeft className="h-3.5 w-3.5 text-violet" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
