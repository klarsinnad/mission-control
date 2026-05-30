"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  MessageSquare,
  RefreshCw,
  Loader2,
  X,
  Hash,
  Calendar,
  FolderTree,
} from "lucide-react";
import { Markdown } from "../Markdown";

interface SessionItem {
  file: string;
  sessionId: string;
  project: string;
  projectSlug: string;
  date: string;
  ts: number;
  title: string;
  turns: number;
  size: number;
  preview: string;
}

interface SessionsPayload {
  sessions: SessionItem[];
  projects: Record<string, { label: string; count: number }>;
  total: number;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 60) return `${m}m sedan`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h sedan`;
  const d = Math.round(h / 24);
  return `${d}d sedan`;
}

export function SessionsView() {
  const [data, setData] = useState<SessionsPayload | null>(null);
  const [q, setQ] = useState("");
  const [project, setProject] = useState<string | null>(null);
  const [open, setOpen] = useState<SessionItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/sessions");
      const d = await r.json();
      setData(d);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function forceImport() {
    setRefreshing(true);
    try {
      await fetch("/api/import?source=claude", { method: "POST" });
      await load();
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.sessions.filter(
      (s) =>
        (!project || s.projectSlug === project) &&
        (!term ||
          s.title.toLowerCase().includes(term) ||
          s.preview.toLowerCase().includes(term) ||
          s.project.toLowerCase().includes(term))
    );
  }, [data, q, project]);

  const projectPills = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.projects)
      .map(([slug, info]) => ({ slug, ...info }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-1">
      {/* search + refresh */}
      <div className="flex gap-2">
        <div className="glass edge-light flex flex-1 items-center gap-2 rounded-2xl px-4 py-1.5">
          <Search className="h-4 w-4 shrink-0 text-violet" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrera sessioner — titel, preview, projekt…"
            className="flex-1 bg-transparent py-2 text-[14.5px] text-white placeholder:text-white/30 focus:outline-none"
          />
          {data && (
            <span className="font-mono text-[10px] text-white/40">
              {filtered.length} / {data.total}
            </span>
          )}
        </div>
        <button
          onClick={forceImport}
          disabled={refreshing}
          title="Trigga import nu (annars var 30:e min via launchd)"
          className="glass glass-hover flex items-center gap-2 rounded-2xl border border-white/10 px-3.5 text-xs text-white/75 disabled:opacity-40"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {refreshing ? "Synkar…" : "Synka nu"}
        </button>
      </div>

      {/* project pills */}
      {projectPills.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setProject(null)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              project === null
                ? "border-violet/50 bg-violet/15 text-white"
                : "border-white/10 text-white/55 hover:text-white"
            }`}
          >
            Alla projekt
            <span className="font-mono text-white/35">{data?.total ?? 0}</span>
          </button>
          {projectPills.map((p) => {
            const active = project === p.slug;
            return (
              <button
                key={p.slug}
                onClick={() => setProject(active ? null : p.slug)}
                title={p.slug}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-violet/50 bg-violet/15 text-white"
                    : "border-white/10 text-white/55 hover:text-white"
                }`}
              >
                <FolderTree className="h-3 w-3" />
                {p.label.length > 30 ? p.label.slice(0, 30) + "…" : p.label}
                <span className="font-mono text-white/35">{p.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* grid */}
      {!data ? (
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Laddar sessioner…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <MessageSquare className="mx-auto mb-3 h-9 w-9 text-white/15" />
          <p className="text-sm text-white/40">
            {q ? `Inga sessioner matchar "${q}"` : "Inga sessioner importerade än."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {filtered.map((s) => (
              <SessionCard key={s.file} session={s} onOpen={() => setOpen(s)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <SessionModal session={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function SessionCard({
  session,
  onOpen,
}: {
  session: SessionItem;
  onOpen: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="glass edge-light"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="group cursor-pointer rounded-2xl p-4 transition-colors hover:bg-white/[0.02] focus:outline-none focus-visible:ring-1 focus-visible:ring-violet/50"
      >
        <div className="mb-1.5 flex items-start justify-between gap-3">
          <p className="line-clamp-2 text-[14px] font-medium text-white">
            {session.title}
          </p>
          <span className="font-mono text-[9px] uppercase tracking-wider text-violet/60">
            {session.sessionId.slice(0, 8)}
          </span>
        </div>

        <div className="line-clamp-1 text-[11px] text-white/35">
          {session.project}
        </div>

        <div className="mt-2.5 flex items-center gap-3 border-t border-white/5 pt-2 font-mono text-[10px] text-white/40">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {session.date}
          </span>
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {session.turns}
          </span>
          <span className="text-white/30">{fmtSize(session.size)}</span>
          <span className="ml-auto text-white/30">{fmtRelative(session.ts)}</span>
        </div>
      </div>
    </motion.div>
  );
}

function SessionModal({
  session,
  onClose,
}: {
  session: SessionItem | null;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setContent(null);
      return;
    }
    setContent(null);
    fetch(`/api/workspace/file?path=${encodeURIComponent(session.file)}`)
      .then((r) => r.text())
      .then((text) => {
        // Strip frontmatter before rendering — it's noise.
        const stripped = text.replace(/^---\n[\s\S]+?\n---\n+/, "");
        setContent(stripped);
      })
      .catch(() => setContent("Kunde inte ladda."));
  }, [session]);

  return (
    <AnimatePresence>
      {session && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass edge-light flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/8 p-4">
              <div className="min-w-0">
                <div className="line-clamp-2 text-[15px] font-semibold text-white">
                  {session.title}
                </div>
                <div className="mt-0.5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                  <span>{session.project}</span>
                  <span>·</span>
                  <span>{session.date}</span>
                  <span>·</span>
                  <span>{session.turns} turer</span>
                  <span>·</span>
                  <span>{fmtSize(session.size)}</span>
                </div>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              {content === null ? (
                <div className="flex items-center justify-center py-10 text-white/40">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Laddar…
                </div>
              ) : (
                <div className="prose prose-invert max-w-none text-[14px]">
                  <Markdown text={content} />
                </div>
              )}
            </div>
            <div className="border-t border-white/8 px-4 py-2 font-mono text-[10px] text-white/30">
              {session.file}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
