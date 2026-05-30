"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Search, MessageSquare, Target, BookOpen, FileText } from "lucide-react";
import { MicButton } from "../MicButton";
import type { SearchHit } from "@/app/api/search/route";

function fileMeta(file: string) {
  const clean = file.replace(/\.md$/, "");
  if (clean.startsWith("Chats/"))
    return { icon: MessageSquare, label: `Chat · ${clean.slice(6)}`, color: "#a78bff" };
  if (clean.startsWith("Journal/"))
    return { icon: BookOpen, label: `Journal · ${clean.slice(8)}`, color: "#22d3ee" };
  if (clean === "Goals")
    return { icon: Target, label: "Goals", color: "#34d399" };
  return { icon: FileText, label: clean, color: "rgba(255,255,255,0.5)" };
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-violet/30 px-0.5 text-white">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function MemoryView() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => setHits(d.hits ?? []))
        .catch(() => setHits([]))
        .finally(() => {
          setLoading(false);
          setSearched(true);
        });
    }, 300);
  }, [q]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const h of hits) {
      if (!map.has(h.file)) map.set(h.file, []);
      map.get(h.file)!.push(h);
    }
    return [...map.entries()];
  }, [hits]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-1">
      {/* search bar */}
      <div className="glass edge-light flex items-center gap-2 rounded-2xl px-4 py-1.5">
        <Search className="h-4.5 w-4.5 shrink-0 text-violet" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search everything your AI remembers — chats, goals, journal…"
          className="flex-1 bg-transparent py-2.5 text-[15px] text-white placeholder:text-white/30 focus:outline-none"
        />
        <MicButton onResult={(t) => setQ((p) => (p ? p + " " : "") + t)} />
      </div>

      {/* states */}
      {!searched && q.trim().length < 2 ? (
        <div className="py-16 text-center">
          <Brain className="mx-auto mb-3 h-9 w-9 text-white/15" />
          <p className="text-sm text-white/40">
            Your AI never forgets. Search across every conversation, goal, and
            journal entry stored in your vault.
          </p>
        </div>
      ) : loading ? (
        <div className="py-10 text-center text-sm text-white/35">Searching…</div>
      ) : grouped.length === 0 ? (
        <div className="py-12 text-center text-sm text-white/40">
          No matches for “{q.trim()}”.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-white/40">
            {hits.length} match{hits.length === 1 ? "" : "es"} across {grouped.length}{" "}
            note{grouped.length === 1 ? "" : "s"}
          </div>
          {grouped.map(([file, fileHits], gi) => {
            const meta = fileMeta(file);
            const Icon = meta.icon;
            return (
              <motion.div
                key={file}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.03 }}
                className="glass edge-light rounded-2xl p-4"
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4" style={{ color: meta.color }} />
                  <span style={{ color: meta.color }}>{meta.label}</span>
                </div>
                <div className="space-y-1.5">
                  {fileHits.slice(0, 6).map((h, i) => (
                    <p
                      key={i}
                      className="border-l-2 border-white/10 pl-3 text-sm leading-relaxed text-white/70"
                    >
                      <Highlight text={h.text} q={q.trim()} />
                    </p>
                  ))}
                  {fileHits.length > 6 && (
                    <p className="pl-3 text-xs text-white/30">
                      +{fileHits.length - 6} more in this note
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
