"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Target, Trash2, Check, Cloud, CloudOff, Loader2 } from "lucide-react";
import { MicButton } from "../MicButton";
import type { Goal, GoalTask } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);
type SaveState = "idle" | "saving" | "saved" | "error";

function pct(g: Goal): number {
  if (!g.tasks.length) return 0;
  return Math.round((g.tasks.filter((t) => t.done).length / g.tasks.length) * 100);
}

export function GoalsView() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [newTitle, setNewTitle] = useState("");
  const [newCat, setNewCat] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((d) => setGoals(d.goals ?? []))
      .catch(() => setGoals([]))
      .finally(() => setLoaded(true));
  }, []);

  const persist = useCallback((next: Goal[]) => {
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: next }),
      })
        .then((r) => (r.ok ? setSave("saved") : setSave("error")))
        .catch(() => setSave("error"));
    }, 500);
  }, []);

  const mutate = useCallback(
    (next: Goal[]) => {
      setGoals(next);
      persist(next);
    },
    [persist]
  );

  function addGoal() {
    const title = newTitle.trim();
    if (!title) return;
    mutate([
      ...goals,
      { id: uid(), title, category: newCat.trim(), tasks: [], createdAt: Date.now() },
    ]);
    setNewTitle("");
    setNewCat("");
  }

  const updateGoal = (id: string, patch: Partial<Goal>) =>
    mutate(goals.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const removeGoal = (id: string) => mutate(goals.filter((g) => g.id !== id));

  function toggleTask(gid: string, tid: string) {
    updateGoal(
      gid,
      {
        tasks: goals
          .find((g) => g.id === gid)!
          .tasks.map((t) => (t.id === tid ? { ...t, done: !t.done } : t)),
      }
    );
  }
  function addTask(gid: string, text: string) {
    const t = text.trim();
    if (!t) return;
    const g = goals.find((x) => x.id === gid)!;
    const task: GoalTask = { id: uid(), text: t, done: false };
    updateGoal(gid, { tasks: [...g.tasks, task] });
  }
  function removeTask(gid: string, tid: string) {
    const g = goals.find((x) => x.id === gid)!;
    updateGoal(gid, { tasks: g.tasks.filter((t) => t.id !== tid) });
  }

  const overall = goals.length
    ? Math.round(goals.reduce((s, g) => s + pct(g), 0) / goals.length)
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-1">
      {/* header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-white/45">
            <Target className="h-4 w-4 text-violet" />
            {goals.length} goal{goals.length === 1 ? "" : "s"} · {overall}% overall
          </div>
          <div className="mt-2 h-1.5 w-56 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,#a78bff,#22d3ee)" }}
              animate={{ width: `${overall}%` }}
              transition={{ type: "spring", stiffness: 60, damping: 16 }}
            />
          </div>
        </div>
        <SaveBadge state={save} />
      </div>

      {/* add goal */}
      <div className="glass edge-light rounded-2xl p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-white/[0.03] px-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGoal()}
              placeholder="New goal…"
              className="flex-1 bg-transparent py-2.5 text-[15px] text-white placeholder:text-white/30 focus:outline-none"
            />
            <MicButton onResult={(t) => setNewTitle((p) => (p ? p + " " : "") + t)} />
          </div>
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGoal()}
            placeholder="Category"
            className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none sm:w-36"
          />
          <button
            onClick={addGoal}
            disabled={!newTitle.trim()}
            className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-30"
            style={{ background: "linear-gradient(135deg,#a78bff,#22d3ee)" }}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {/* goals */}
      {!loaded ? (
        <div className="py-10 text-center text-sm text-white/35">Loading…</div>
      ) : goals.length === 0 ? (
        <div className="py-14 text-center">
          <Target className="mx-auto mb-3 h-8 w-8 text-white/20" />
          <p className="text-sm text-white/40">
            No goals yet. Add your top targets — your agents will know what you&apos;re
            working towards.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onToggle={(tid) => toggleTask(g.id, tid)}
                onAddTask={(t) => addTask(g.id, t)}
                onRemoveTask={(tid) => removeTask(g.id, tid)}
                onRemove={() => removeGoal(g.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  onToggle,
  onAddTask,
  onRemoveTask,
  onRemove,
}: {
  goal: Goal;
  onToggle: (tid: string) => void;
  onAddTask: (text: string) => void;
  onRemoveTask: (tid: string) => void;
  onRemove: () => void;
}) {
  const [task, setTask] = useState("");
  const p = pct(goal);

  function submit() {
    onAddTask(task);
    setTask("");
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="glass edge-light group rounded-2xl p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-white">{goal.title}</h3>
          {goal.category && (
            <span className="text-[11px] uppercase tracking-[0.18em] text-violet/70">
              {goal.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm tabular-nums text-emerald">{p}%</span>
          <button
            onClick={onRemove}
            className="text-white/20 opacity-0 transition-opacity hover:text-rose group-hover:opacity-100"
            title="Delete goal"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="my-3 h-1.5 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg,#34d399,#22d3ee)" }}
          animate={{ width: `${p}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 18 }}
        />
      </div>

      <div className="space-y-1">
        {goal.tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
            <button
              onClick={() => onToggle(t.id)}
              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors"
              style={
                t.done
                  ? { background: "#34d399", borderColor: "#34d399" }
                  : { borderColor: "rgba(255,255,255,0.2)" }
              }
            >
              {t.done && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
            </button>
            <span
              className={`flex-1 text-sm ${
                t.done ? "text-white/35 line-through" : "text-white/85"
              }`}
            >
              {t.text}
            </span>
            <button
              onClick={() => onRemoveTask(t.id)}
              className="text-white/15 opacity-0 transition-opacity hover:text-rose group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/[0.03] px-3">
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add a step…"
          className="flex-1 bg-transparent py-2 text-sm text-white placeholder:text-white/25 focus:outline-none"
        />
        <MicButton onResult={(t) => setTask((p) => (p ? p + " " : "") + t)} />
      </div>
    </motion.div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const map = {
    idle: { icon: Cloud, text: "Synced to vault", color: "rgba(255,255,255,0.35)" },
    saving: { icon: Loader2, text: "Saving…", color: "#a78bff" },
    saved: { icon: Check, text: "Saved", color: "#34d399" },
    error: { icon: CloudOff, text: "Save failed", color: "#fb7185" },
  }[state];
  const Icon = map.icon;
  return (
    <div
      className="flex items-center gap-1.5 text-[11px]"
      style={{ color: map.color }}
    >
      <Icon className={`h-3.5 w-3.5 ${state === "saving" ? "animate-spin" : ""}`} />
      {map.text}
    </div>
  );
}
