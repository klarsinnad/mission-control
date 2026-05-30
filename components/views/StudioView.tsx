"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Wand2,
  X,
  Copy,
  Check,
  Download,
  ChevronDown,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { MicButton } from "../MicButton";

interface StudioImage {
  id: string;
  prompt: string;
  refinedPrompt?: string;
  refinedBy?: string;
  agentId?: string;
  model: string;
  size: string;
  quality?: string;
  file: string;
  createdAt: number;
}

const MODELS = [
  { id: "gpt-image-1", label: "gpt-image-1", hint: "balanced" },
  { id: "gpt-image-1-mini", label: "gpt-image-1-mini", hint: "fast · cheap" },
  { id: "gpt-image-1.5", label: "gpt-image-1.5", hint: "newer" },
  { id: "gpt-image-2", label: "gpt-image-2", hint: "newest" },
  { id: "dall-e-3", label: "DALL·E 3", hint: "classic" },
];

const SIZES = ["1024x1024", "1536x1024", "1024x1536"];
const QUALITIES = ["low", "medium", "high", "auto"];

export function StudioView() {
  const { agents } = useStore();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-image-1");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("high");
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<StudioImage[]>([]);
  const [open, setOpen] = useState<StudioImage | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function refresh() {
    try {
      const r = await fetch("/api/studio");
      const d = await r.json();
      setImages(d.images ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function generate() {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/studio/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: p,
          model,
          size,
          quality,
          agentId: agentId || undefined,
        }),
      });
      const d = await r.json();
      if (d.image) {
        setImages((prev) => [d.image, ...prev]);
        setPrompt("");
        if (taRef.current) taRef.current.style.height = "auto";
      } else {
        setError(d.error || "Failed to generate");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  function autosize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 py-1">
      <div className="flex items-center gap-2 text-sm text-white/45">
        <ImageIcon className="h-4 w-4 text-violet" />
        Generate images via OpenAI · optional Q-agent director · all saved to vault
      </div>

      {/* Composer */}
      <div className="glass edge-light rounded-2xl p-3">
        <textarea
          ref={taRef}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            autosize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
          }}
          rows={2}
          placeholder="Describe the image…  (⌘⏎ to generate)"
          className="max-h-[200px] min-h-[68px] w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-white placeholder:text-white/30 focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-1 pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <DirectorPicker
              value={agentId}
              onChange={setAgentId}
              agents={agents.map((a) => ({ id: a.id, name: a.name, accent: a.accent }))}
            />
            <Picker label={model} value={model} onChange={setModel} options={MODELS.map(m => ({ id: m.id, label: m.label }))} />
            <Picker label={size} value={size} onChange={setSize} options={SIZES.map(s => ({ id: s, label: s }))} />
            <Picker label={quality} value={quality} onChange={setQuality} options={QUALITIES.map(q => ({ id: q, label: q }))} />
          </div>
          <div className="flex items-center gap-2">
            <MicButton
              onResult={(t) => {
                setPrompt((p) => (p ? p.replace(/\s+$/, "") + " " : "") + t);
                requestAnimationFrame(autosize);
              }}
              title="Dictate the prompt"
            />
            <button
              onClick={generate}
              disabled={!prompt.trim() || busy}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-30"
              style={{
                background: "linear-gradient(135deg,#a78bff,#e879f9)",
                boxShadow: "0 0 20px rgba(232,121,249,0.45)",
              }}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" /> Generate
                </>
              )}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-2 rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose">
            {error}
          </div>
        )}
      </div>

      {/* Gallery */}
      {images.length === 0 ? (
        <div className="py-16 text-center">
          <Sparkles className="mx-auto mb-3 h-9 w-9 text-white/15" />
          <p className="text-sm text-white/40">
            No images yet. Write a prompt above — give Visualizer the director
            role for richer composition.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence initial={false}>
            {images.map((img) => (
              <motion.button
                key={img.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onClick={() => setOpen(img)}
                className="glass edge-light group relative aspect-square overflow-hidden rounded-xl"
              >
                <img
                  src={`/api/studio/file?path=${encodeURIComponent(img.file)}`}
                  alt={img.prompt}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="line-clamp-2 text-left text-[11px] text-white/90">
                    {img.prompt}
                  </p>
                  {img.refinedBy && (
                    <span className="mt-0.5 inline-block rounded bg-violet/30 px-1.5 py-0.5 font-mono text-[9px] text-white">
                      ↺ {img.refinedBy}
                    </span>
                  )}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Lightbox */}
      <Lightbox image={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Picker({
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 pr-7 font-mono text-xs text-white/75 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
    </div>
  );
}

function DirectorPicker({
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
        <option value="">No director · raw prompt</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            Director: {a.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
    </div>
  );
}

function Lightbox({ image, onClose }: { image: StudioImage | null; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, tag: string) {
    navigator.clipboard?.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied(null), 1400);
  }

  return (
    <AnimatePresence>
      {image && (
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
            className="glass edge-light flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 md:flex-row"
          >
            <div className="relative flex-1 bg-black/40">
              <img
                src={`/api/studio/file?path=${encodeURIComponent(image.file)}`}
                alt={image.prompt}
                className="h-full max-h-[80vh] w-full object-contain"
              />
            </div>
            <div className="flex w-full flex-col gap-3 p-5 md:w-80">
              <div className="flex items-start justify-between">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                  {new Date(image.createdAt).toLocaleString("sv-SE")}
                </div>
                <button
                  onClick={onClose}
                  className="text-white/40 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Field label="Prompt" value={image.prompt} copied={copied === "prompt"} onCopy={() => copy(image.prompt, "prompt")} />
              {image.refinedPrompt && (
                <Field
                  label={`Refined by ${image.refinedBy ?? "agent"}`}
                  value={image.refinedPrompt}
                  copied={copied === "refined"}
                  onCopy={() => copy(image.refinedPrompt!, "refined")}
                />
              )}
              <div className="grid grid-cols-2 gap-2 font-mono text-[10px] text-white/55">
                <span>model: {image.model}</span>
                <span>size: {image.size}</span>
                {image.quality && <span>quality: {image.quality}</span>}
              </div>
              <a
                href={`/api/studio/file?path=${encodeURIComponent(image.file)}`}
                download
                className="glass-hover flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs text-white/75"
              >
                <Download className="h-3.5 w-3.5" /> Download PNG
              </a>
              <div className="font-mono text-[10px] text-white/35 break-all">
                {image.file}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
          {label}
        </div>
        <button onClick={onCopy} className="text-white/40 hover:text-white">
          {copied ? <Check className="h-3 w-3 text-emerald" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <p className="text-[12.5px] leading-relaxed text-white/80">{value}</p>
    </div>
  );
}
