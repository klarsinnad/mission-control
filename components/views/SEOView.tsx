"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Sparkles,
  Loader2,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Code2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { MicButton } from "../MicButton";
import { Markdown } from "../Markdown";

interface Draft {
  file: string;
  keyword?: string;
  title?: string;
  slug?: string;
  date?: string;
}

const BRAINS: { value: string; label: string; group: string }[] = [
  { value: "claude:claude-opus-4-7", label: "Opus 4.7", group: "Claude" },
  { value: "claude:claude-sonnet-4-6", label: "Sonnet 4.6", group: "Claude" },
  { value: "claude:claude-haiku-4-5", label: "Haiku 4.5", group: "Claude" },
  { value: "openai:gpt-4o", label: "GPT-4o", group: "OpenAI" },
  { value: "openai:gpt-4o-mini", label: "GPT-4o-mini", group: "OpenAI" },
  { value: "openai:gpt-5", label: "GPT-5", group: "OpenAI" },
  { value: "hermes:gpt-4o", label: "GPT-4o", group: "Hermes (Copilot)" },
];

function parseBrain(v: string): { provider: "claude" | "openai" | "hermes"; model: string } {
  const [p, ...rest] = v.split(":");
  const provider = p === "openai" ? "openai" : p === "hermes" ? "hermes" : "claude";
  return { provider, model: rest.join(":") || "claude-sonnet-4-6" };
}

export function SEOView() {
  const { agents } = useStore();
  const [keyword, setKeyword] = useState("");
  const [instructions, setInstructions] = useState("");
  const [productNames, setProductNames] = useState("");
  const [agentId, setAgentId] = useState("content-formatter-01");
  const [brain, setBrain] = useState("claude:claude-sonnet-4-6");
  const [article, setArticle] = useState("");
  const [articleSlug, setArticleSlug] = useState("");
  const [meta, setMeta] = useState("");
  const [busy, setBusy] = useState<"" | "article" | "meta">("");
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await fetch("/api/seo");
      const d = await r.json();
      setDrafts(d.drafts ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function generateArticle() {
    const k = keyword.trim();
    if (!k || busy) return;
    setBusy("article");
    setError(null);
    setArticle("");
    setMeta("");
    try {
      const { provider, model } = parseBrain(brain);
      const r = await fetch("/api/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "article",
          keyword: k,
          instructions: instructions.trim() || undefined,
          agentId,
          provider,
          hermesProvider: provider === "hermes" ? "copilot" : undefined,
          model,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setArticle(d.article);
        setArticleSlug(d.slug);
        refresh();
      } else {
        setError(d.error || "Failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy("");
    }
  }

  async function generateMeta() {
    if (!article || busy) return;
    setBusy("meta");
    setError(null);
    try {
      const { provider, model } = parseBrain(brain);
      const r = await fetch("/api/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "meta",
          article,
          productNames: productNames.trim() || undefined,
          agentId,
          provider,
          hermesProvider: provider === "hermes" ? "copilot" : undefined,
          model,
        }),
      });
      const d = await r.json();
      if (d.ok) setMeta(d.meta);
      else setError(d.error || "Failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy("");
    }
  }

  async function loadDraft(d: Draft) {
    if (!d.file) return;
    try {
      const r = await fetch(`/api/workspace/file?path=${encodeURIComponent(d.file)}`);
      const text = await r.text();
      const body = text.replace(/^---[\s\S]+?---\n+/, "");
      setArticle(body.trim());
      setArticleSlug(d.slug ?? "");
      setKeyword(d.keyword ?? "");
      setMeta("");
    } catch {
      /* ignore */
    }
  }

  function copy(text: string, tag: string) {
    navigator.clipboard?.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied(null), 1400);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-1">
      <div className="flex items-center gap-2 text-sm text-white/45">
        <Search className="h-4 w-4 text-violet" />
        Keyword in · Content Formatter writes · Kangaroo-ready metadata
      </div>

      {/* Input */}
      <div className="glass edge-light space-y-2 rounded-2xl p-3">
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3">
          <Search className="h-4 w-4 text-violet" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && generateArticle()}
            placeholder="Keyword / topic — t.ex. 'BPC-157 för senläkning'"
            className="flex-1 bg-transparent py-2.5 text-[15px] text-white placeholder:text-white/30 focus:outline-none"
          />
          <MicButton onResult={(t) => setKeyword((p) => (p ? p + " " : "") + t)} />
        </div>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
          placeholder="Extra direction (optional) — t.ex. fokus på dosering eller målgrupp"
          className="max-h-[120px] w-full resize-none rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-1 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <AgentPicker
              value={agentId}
              onChange={setAgentId}
              agents={agents.map((a) => ({ id: a.id, name: a.name }))}
            />
            <BrainPicker value={brain} onChange={setBrain} />
          </div>
          <button
            onClick={generateArticle}
            disabled={!keyword.trim() || !!busy}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-30"
            style={{
              background: "linear-gradient(135deg,#a78bff,#22d3ee)",
              boxShadow: "0 0 20px rgba(139,123,255,0.45)",
            }}
          >
            {busy === "article" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Drafting…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Draft article
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose">
            {error}
          </div>
        )}
      </div>

      {/* Article preview */}
      {article && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass edge-light rounded-2xl p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
              <FileText className="h-3.5 w-3.5 text-violet" />
              Draft · slug: <span className="font-mono text-violet/80">{articleSlug}</span>
            </div>
            <button
              onClick={() => copy(article, "article")}
              className="glass-hover flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/70"
            >
              {copied === "article" ? <Check className="h-3 w-3 text-emerald" /> : <Copy className="h-3 w-3" />}
              Copy MD
            </button>
          </div>
          <div className="prose prose-invert max-w-none text-[14.5px]">
            <Markdown text={article} />
          </div>
        </motion.div>
      )}

      {/* Kangaroo metadata generator */}
      {article && (
        <div className="glass edge-light space-y-3 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
            <Code2 className="h-3.5 w-3.5 text-violet" />
            Kangaroo PROTOCOLS + TAXONOMY
          </div>
          <input
            value={productNames}
            onChange={(e) => setProductNames(e.target.value)}
            placeholder="Optional: canonical product names from your store (comma separated)"
            className="w-full rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <button
            onClick={generateMeta}
            disabled={!!busy}
            className="glass glass-hover flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/80 disabled:opacity-30"
          >
            {busy === "meta" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" /> Generate snippets
              </>
            )}
          </button>
          {meta && (
            <div className="relative">
              <pre className="max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-xs leading-relaxed text-white/85">
                <code>{meta}</code>
              </pre>
              <button
                onClick={() => copy(meta, "meta")}
                className="glass-hover absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1.5 text-xs text-white/70"
              >
                {copied === "meta" ? <Check className="h-3 w-3 text-emerald" /> : <Copy className="h-3 w-3" />}
                Copy
              </button>
            </div>
          )}
        </div>
      )}

      {/* Past drafts */}
      {drafts.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            Past drafts ({drafts.length})
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {drafts.map((d) => (
              <button
                key={d.file}
                onClick={() => loadDraft(d)}
                className="glass glass-hover edge-light rounded-xl p-3 text-left"
              >
                <div className="truncate text-sm font-medium text-white">
                  {d.title || d.keyword}
                </div>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-white/35">
                  <span>{d.date}</span>
                  <span className="text-violet/60">·</span>
                  <span className="truncate">{d.slug}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
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
  agents: { id: string; name: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 pr-7 text-xs text-white/75 focus:outline-none"
    >
      <option value="">No agent context</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          Director: {a.name}
        </option>
      ))}
    </select>
  );
}

function BrainPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const groups: Record<string, typeof BRAINS> = {};
  for (const b of BRAINS) (groups[b.group] ||= []).push(b);
  return (
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
  );
}
