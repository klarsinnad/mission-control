"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  Image as ImageIcon,
  ListTodo,
  CalendarDays,
  BookOpen,
  MessageSquare,
  Radio,
  X,
  Search,
  Loader2,
} from "lucide-react";
import { Markdown } from "../Markdown";

type WsType =
  | "task"
  | "image"
  | "summary"
  | "journal"
  | "chat"
  | "agent-chat"
  | "imported-chatgpt"
  | "imported-claude";

interface WsItem {
  id: string;
  type: WsType;
  title: string;
  subtitle?: string;
  date: string;
  ts: number;
  file?: string;
  thumbUrl?: string;
  badge?: string;
  badgeColor?: string;
}

const TYPE_META: Record<
  WsType,
  { label: string; icon: typeof Briefcase; color: string }
> = {
  task: { label: "Tasks", icon: ListTodo, color: "#a78bff" },
  image: { label: "Studio", icon: ImageIcon, color: "#e879f9" },
  summary: { label: "Retros", icon: CalendarDays, color: "#22d3ee" },
  journal: { label: "Journal", icon: BookOpen, color: "#34d399" },
  chat: { label: "Console", icon: MessageSquare, color: "#a78bff" },
  "agent-chat": { label: "Control Rooms", icon: Radio, color: "#fb7185" },
  "imported-chatgpt": { label: "ChatGPT", icon: MessageSquare, color: "#10a37f" },
  "imported-claude": { label: "Claude", icon: MessageSquare, color: "#cc785c" },
};

export function WorkspaceView() {
  const [items, setItems] = useState<WsItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<WsType | "all">("all");
  const [q, setQ] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<WsItem | null>(null);

  useEffect(() => {
    fetch("/api/workspace")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setCounts(d.counts ?? {});
      })
      .catch(() => null)
      .finally(() => setLoaded(true));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(
      (it) =>
        (filter === "all" || it.type === filter) &&
        (!term ||
          it.title.toLowerCase().includes(term) ||
          (it.subtitle ?? "").toLowerCase().includes(term) ||
          (it.badge ?? "").toLowerCase().includes(term))
    );
  }, [items, filter, q]);

  const tabs: { id: WsType | "all"; label: string; count: number }[] = [
    { id: "all", label: "All", count: items.length },
    ...(Object.entries(TYPE_META) as [WsType, typeof TYPE_META[WsType]][])
      .map(([id, meta]) => ({ id, label: meta.label, count: counts[id] ?? 0 }))
      .filter((t) => t.count > 0),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-1">
      {/* search */}
      <div className="glass edge-light flex items-center gap-2 rounded-2xl px-4 py-1.5">
        <Search className="h-4 w-4 shrink-0 text-violet" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter the workspace — title, agent, date…"
          className="flex-1 bg-transparent py-2 text-[14.5px] text-white placeholder:text-white/30 focus:outline-none"
        />
      </div>

      {/* tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => {
          const active = filter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "border-violet/50 bg-violet/15 text-white"
                  : "border-white/10 text-white/55 hover:text-white"
              }`}
            >
              {t.label}
              <span className="font-mono text-white/35">{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* grid */}
      {!loaded ? (
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading workspace…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Briefcase className="mx-auto mb-3 h-9 w-9 text-white/15" />
          <p className="text-sm text-white/40">
            {q ? `Nothing matches "${q}".` : "No artifacts yet — build something."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {filtered.map((it) => (
              <Card key={it.id} item={it} onOpen={() => setOpen(it)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ItemModal item={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Card({ item, onOpen }: { item: WsItem; onOpen: () => void }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      onClick={onOpen}
      className="glass glass-hover edge-light group relative flex flex-col overflow-hidden rounded-2xl text-left"
    >
      {item.thumbUrl ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40">
          <img
            src={item.thumbUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className="flex aspect-[4/3] w-full items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${meta.color}1f, transparent)`,
          }}
        >
          <Icon className="h-9 w-9" style={{ color: meta.color }} />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="line-clamp-2 text-[13.5px] font-medium text-white">
            {item.title}
          </div>
          <div
            className="rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
            style={{
              background: `${meta.color}1f`,
              color: meta.color,
            }}
          >
            {meta.label}
          </div>
        </div>
        {item.subtitle && (
          <p className="line-clamp-1 text-[11px] text-white/40">
            {item.subtitle}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 font-mono text-[10px] text-white/35">
          <span>{item.date}</span>
          {item.badge && (
            <span
              className="rounded px-1.5 py-0.5"
              style={{
                background: `${item.badgeColor ?? "#a78bff"}1a`,
                color: item.badgeColor ?? "#a78bff",
              }}
            >
              {item.badge}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function ItemModal({
  item,
  onClose,
}: {
  item: WsItem | null;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!item || !item.file) {
      setContent(null);
      return;
    }
    // Images are rendered directly via thumbUrl; skip text fetch.
    if (item.type === "image") {
      setContent(null);
      return;
    }
    setContent(null);
    fetch(`/api/workspace/file?path=${encodeURIComponent(item.file)}`)
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setContent("Failed to load."));
  }, [item]);

  return (
    <AnimatePresence>
      {item && (
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
                <div className="truncate text-[15px] font-semibold text-white">
                  {item.title}
                </div>
                <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                  {TYPE_META[item.type].label} · {item.date}
                </div>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              {item.type === "image" && item.thumbUrl ? (
                <img
                  src={item.thumbUrl}
                  alt={item.title}
                  className="mx-auto max-h-[70vh] object-contain"
                />
              ) : content === null && item.file ? (
                <div className="flex items-center justify-center py-10 text-white/40">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : content ? (
                <div className="prose prose-invert max-w-none text-[14.5px]">
                  <Markdown text={content} />
                </div>
              ) : (
                <div className="text-sm text-white/40">No content.</div>
              )}
            </div>
            {item.file && (
              <div className="border-t border-white/8 px-4 py-2 font-mono text-[10px] text-white/30">
                {item.file}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
