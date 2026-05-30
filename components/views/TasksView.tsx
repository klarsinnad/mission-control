"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ListTodo,
  Play,
  Loader2,
  Check,
  X,
  Trash2,
  ChevronDown,
  Sparkles,
  CircleDot,
  Moon,
  Clock,
  Zap,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { MicButton } from "../MicButton";
import { Markdown } from "../Markdown";
import type { Task, TaskStatus } from "@/lib/types";

// Unified picker: each option carries provider + model encoded as "<provider>:<model>".
// Claude variants use the local CLI on Aydin's subscription (no per-token cost).
// Hermes variants route through `hermes -z` via GitHub Copilot (his Copilot plan).
const BRAINS: { value: string; label: string; group: string }[] = [
  { value: "claude:claude-opus-4-7", label: "Opus 4.7", group: "Claude · subscription" },
  { value: "claude:claude-sonnet-4-6", label: "Sonnet 4.6", group: "Claude · subscription" },
  { value: "claude:claude-haiku-4-5", label: "Haiku 4.5", group: "Claude · subscription" },
  { value: "openai:gpt-4o", label: "GPT-4o", group: "OpenAI · pay-per-token" },
  { value: "openai:gpt-4o-mini", label: "GPT-4o-mini", group: "OpenAI · pay-per-token" },
  { value: "openai:gpt-5", label: "GPT-5", group: "OpenAI · pay-per-token" },
  { value: "openai:o4-mini", label: "o4-mini (reasoning)", group: "OpenAI · pay-per-token" },
  { value: "hermes:gpt-4o", label: "GPT-4o", group: "Hermes · via Copilot (50/mån)" },
  { value: "hermes:gpt-4o-mini", label: "GPT-4o-mini", group: "Hermes · via Copilot (50/mån)" },
  { value: "hermes:o4-mini", label: "o4-mini", group: "Hermes · via Copilot (50/mån)" },
  { value: "hermes:claude-sonnet-4.6", label: "Claude Sonnet 4.6", group: "Hermes · via Copilot (50/mån)" },
];

function parseBrain(v: string): { provider: "claude" | "hermes" | "openai"; model: string } {
  const [p, ...rest] = v.split(":");
  const provider =
    p === "hermes" ? "hermes" : p === "openai" ? "openai" : "claude";
  return { provider, model: rest.join(":") || "claude-sonnet-4-6" };
}

const EFFORTS = [
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Extra high" },
];

export function TasksView() {
  const { agents } = useStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [agentId, setAgentId] = useState<string>("");
  const [brain, setBrain] = useState("claude:claude-sonnet-4-6");
  const [effort, setEffort] = useState("high");
  const [background, setBackground] = useState(false);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  async function refresh() {
    try {
      const r = await fetch("/api/tasks");
      const d = await r.json();
      setTasks(d.tasks ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Live polling: while any task is queued/running, refresh every 3s.
  useEffect(() => {
    const active = tasks.some(
      (t) => t.status === "queued" || t.status === "running"
    );
    if (!active) return;
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [tasks]);

  async function run() {
    const t = title.trim();
    const d = desc.trim();
    if (!t || !d || running) return;
    setRunning(true);
    try {
      const { provider, model } = parseBrain(brain);
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          description: d,
          agentId: agentId || undefined,
          model,
          provider,
          hermesProvider: provider === "hermes" ? "copilot" : undefined,
          mode: background ? "background" : "sync",
          effort: background && provider === "claude" ? effort : undefined,
        }),
      });
      const data = await r.json();
      if (data.task) {
        setTasks((prev) => [data.task, ...prev.filter((x) => x.id !== data.task.id)]);
        setExpanded(data.task.id);
      }
      setTitle("");
      setDesc("");
      if (descRef.current) descRef.current.style.height = "auto";
    } catch {
      /* fall back to refresh */
      refresh();
    } finally {
      setRunning(false);
    }
  }

  async function remove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks?id=${id}`, { method: "DELETE" }).catch(() => null);
  }

  function autosize() {
    const ta = descRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
  }

  const backlog = tasks.filter(
    (t) => t.status === "queued" || t.status === "running"
  ).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-1">
      <div className="flex items-center justify-between gap-3 text-sm text-white/45">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-violet" />
          Delegate to a Q agent · sync or background · saved to vault
        </div>
        {backlog > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-violet/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-violet">
            <Loader2 className="h-3 w-3 animate-spin" /> {backlog} working
          </span>
        )}
      </div>

      {/* New task form */}
      <div className="glass edge-light rounded-2xl p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title…"
          className="w-full bg-transparent px-3 py-2 text-[15px] font-medium text-white placeholder:text-white/30 focus:outline-none"
        />
        <div className="relative">
          <textarea
            ref={descRef}
            value={desc}
            onChange={(e) => {
              setDesc(e.target.value);
              autosize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
            placeholder="Describe the task…  (⌘⏎ to run)"
            rows={2}
            className="max-h-[220px] min-h-[68px] w-full resize-none bg-transparent px-3 py-2 text-[14.5px] leading-relaxed text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-1 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <AgentPicker
              value={agentId}
              onChange={setAgentId}
              agents={agents.map((a) => ({ id: a.id, name: a.name, accent: a.accent }))}
            />
            <BrainPicker value={brain} onChange={setBrain} />
            {background && <EffortPicker value={effort} onChange={setEffort} />}
            <BgToggle on={background} onChange={setBackground} />
          </div>
          <div className="flex items-center gap-2">
            <MicButton
              onResult={(t) => {
                setDesc((p) => (p ? p.replace(/\s+$/, "") + " " : "") + t);
                requestAnimationFrame(autosize);
              }}
              title="Dictate the task"
            />
            <button
              onClick={run}
              disabled={!title.trim() || !desc.trim() || running}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-30"
              style={
                background
                  ? {
                      background: "linear-gradient(135deg,#6366f1,#22d3ee)",
                      boxShadow: "0 0 20px rgba(99,102,241,0.55)",
                    }
                  : {
                      background: "linear-gradient(135deg,#a78bff,#22d3ee)",
                      boxShadow: "0 0 20px rgba(139,123,255,0.45)",
                    }
              }
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Queuing…
                </>
              ) : background ? (
                <>
                  <Moon className="h-4 w-4" /> Queue
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Run
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="py-12 text-center text-sm text-white/40">
          No tasks yet. Type one above and hit Run.
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                open={expanded === t.id}
                onToggle={() => setExpanded((e) => (e === t.id ? null : t.id))}
                onDelete={() => remove(t.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  open,
  onToggle,
  onDelete,
}: {
  task: Task;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="glass edge-light group rounded-2xl"
    >
      {/* Outer is a div (not a button) so the inner Delete button can be a real <button> — nested <button>s are invalid HTML and trigger a hydration error. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex w-full cursor-pointer items-start gap-3 p-4 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-violet/50"
      >
        <StatusDot status={task.status} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-white">
            {task.title}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-white/35">
            {task.agentName ? `${task.agentName} · ` : ""}
            {task.model} · {new Date(task.createdAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <ChevronDown
          className={`mt-1 h-4 w-4 text-white/35 transition-transform ${open ? "rotate-180" : ""}`}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="mt-1 text-white/20 opacity-0 transition-opacity hover:text-rose group-hover:opacity-100"
          title="Delete task"
          aria-label="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-white/5 px-4 pb-4 pt-3">
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Task
                </div>
                <p className="whitespace-pre-wrap text-sm text-white/70">
                  {task.description}
                </p>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/40">
                  <Sparkles className="h-3 w-3 text-violet" /> Result
                </div>
                {task.result ? (
                  <div className="text-sm text-white/85">
                    <Markdown text={task.result} />
                  </div>
                ) : task.error ? (
                  <div className="rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose">
                    {task.error}
                  </div>
                ) : (
                  <div className="text-sm text-white/40">(no output yet)</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatusDot({ status }: { status: TaskStatus }) {
  const map = {
    queued: { color: "#6366f1", icon: Clock, spin: false },
    running: { color: "#a78bff", icon: Loader2, spin: true },
    done: { color: "#34d399", icon: Check, spin: false },
    failed: { color: "#fb7185", icon: X, spin: false },
  }[status];
  const Icon = map.icon;
  return (
    <span
      className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
      style={{ color: map.color }}
    >
      <Icon className={`h-3.5 w-3.5 ${map.spin ? "animate-spin" : ""}`} />
    </span>
  );
}

function BgToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      title={on ? "Background mode — runs while you're away" : "Sync mode — runs now"}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
        on
          ? "border-iris/50 bg-iris/15 text-white"
          : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
      }`}
      style={on ? { borderColor: "rgba(99,102,241,0.5)", background: "rgba(99,102,241,0.15)" } : undefined}
    >
      <Moon className="h-3.5 w-3.5" />
      Background
    </button>
  );
}

function EffortPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Zap className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-amber" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/[0.03] py-1.5 pl-7 pr-7 text-xs text-white/75 focus:outline-none"
      >
        {EFFORTS.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
    </div>
  );
}

function AgentPicker({
  value,
  onChange,
  agents,
}: {
  value: string;
  onChange: (id: string) => void;
  agents: { id: string; name: string; accent: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 pr-7 text-xs text-white/75 focus:outline-none"
      >
        <option value="">No specific agent</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
    </div>
  );
}

function BrainPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Group BRAINS by group name in declaration order.
  const groups: Record<string, typeof BRAINS> = {};
  for (const b of BRAINS) (groups[b.group] ||= []).push(b);
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 pr-7 text-xs text-white/75 focus:outline-none"
      >
        {Object.entries(groups).map(([g, items]) => (
          <optgroup key={g} label={g}>
            {items.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
    </div>
  );
}
