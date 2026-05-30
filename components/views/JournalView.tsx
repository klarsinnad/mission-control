"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { MicButton } from "../MicButton";

type SaveState = "idle" | "saving" | "saved" | "error";

const todayStr = () => new Date().toLocaleDateString("sv-SE");
function shift(date: string, delta: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString("sv-SE");
}
function pretty(date: string): string {
  const d = new Date(date + "T12:00:00");
  const label = d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return date === todayStr() ? `Today · ${label}` : label;
}

export function JournalView() {
  const [date, setDate] = useState(todayStr());
  const [content, setContent] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [save, setSave] = useState<SaveState>("idle");
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Load the selected day.
  useEffect(() => {
    setLoaded(false);
    fetch(`/api/journal?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content ?? "");
        setDates(d.dates ?? []);
        setSave("idle");
      })
      .catch(() => setContent(""))
      .finally(() => setLoaded(true));
  }, [date]);

  const persist = useCallback(
    (value: string, forDate: string) => {
      setSave("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fetch("/api/journal", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: forDate, content: value }),
        })
          .then((r) => (r.ok ? setSave("saved") : setSave("error")))
          .then(() => {
            if (!dates.includes(forDate))
              setDates((p) => [forDate, ...p].sort().reverse());
          })
          .catch(() => setSave("error"));
      }, 700);
    },
    [dates]
  );

  function onChange(value: string) {
    setContent(value);
    persist(value, date);
  }

  function appendDictation(text: string) {
    if (!text) return;
    onChange((content ? content.replace(/\s+$/, "") + " " : "") + text);
  }

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 py-1">
      {/* date nav */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDate((d) => shift(d, -1))}
            className="glass glass-hover flex h-9 w-9 items-center justify-center rounded-xl text-white/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="glass flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm text-white">
            <CalendarDays className="h-4 w-4 text-violet" />
            {pretty(date)}
          </div>
          <button
            onClick={() => setDate((d) => shift(d, 1))}
            disabled={date >= todayStr()}
            className="glass glass-hover flex h-9 w-9 items-center justify-center rounded-xl text-white/60 disabled:opacity-25"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {date !== todayStr() && (
            <button
              onClick={() => setDate(todayStr())}
              className="ml-1 rounded-lg px-2.5 py-1.5 text-xs text-violet hover:bg-violet/10"
            >
              Today
            </button>
          )}
        </div>
        <SaveBadge state={save} />
      </div>

      {/* editor */}
      <div className="glass edge-light relative flex min-h-0 flex-1 flex-col rounded-2xl p-1.5">
        <textarea
          ref={taRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          disabled={!loaded}
          placeholder={
            loaded
              ? "What happened today? What's on your mind? One thing you're grateful for…"
              : "Loading…"
          }
          className="min-h-0 flex-1 resize-none rounded-xl bg-transparent px-4 py-3 text-[15px] leading-relaxed text-white placeholder:text-white/25 focus:outline-none"
        />
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[11px] text-white/30">{words} words</span>
          <MicButton onResult={appendDictation} title="Dictate your entry" />
        </div>
      </div>

      {/* recent entries */}
      {dates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dates.slice(0, 14).map((d) => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`rounded-lg px-2.5 py-1 font-mono text-[11px] transition-colors ${
                d === date
                  ? "bg-violet/20 text-white"
                  : "bg-white/[0.03] text-white/45 hover:text-white/80"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const map = {
    idle: { icon: Cloud, text: "Saved to vault", color: "rgba(255,255,255,0.35)" },
    saving: { icon: Loader2, text: "Saving…", color: "#a78bff" },
    saved: { icon: Check, text: "Saved", color: "#34d399" },
    error: { icon: CloudOff, text: "Save failed", color: "#fb7185" },
  }[state];
  const Icon = map.icon;
  return (
    <motion.div
      className="flex items-center gap-1.5 text-[11px]"
      style={{ color: map.color }}
    >
      <Icon className={`h-3.5 w-3.5 ${state === "saving" ? "animate-spin" : ""}`} />
      {map.text}
    </motion.div>
  );
}
