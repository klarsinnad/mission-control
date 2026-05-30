"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Sparkles, Square, Cpu, Eraser } from "lucide-react";
import { useStore } from "@/lib/store";
import { Markdown } from "../Markdown";
import { MicButton } from "../MicButton";
import type { ChatMessage } from "@/lib/types";

// Unified brain picker — Claude on subscription, OpenAI direct (pay-per-token,
// streaming via SSE), Hermes via Copilot (50/månad gratis, non-streaming).
const BRAINS: { value: string; label: string; group: string }[] = [
  { value: "claude:claude-opus-4-7", label: "Opus 4.7", group: "Claude · subscription" },
  { value: "claude:claude-sonnet-4-6", label: "Sonnet 4.6", group: "Claude · subscription" },
  { value: "claude:claude-haiku-4-5", label: "Haiku 4.5", group: "Claude · subscription" },
  { value: "openai:gpt-4o", label: "GPT-4o", group: "OpenAI · pay-per-token" },
  { value: "openai:gpt-4o-mini", label: "GPT-4o-mini", group: "OpenAI · pay-per-token" },
  { value: "openai:gpt-5", label: "GPT-5", group: "OpenAI · pay-per-token" },
  { value: "openai:o4-mini", label: "o4-mini", group: "OpenAI · pay-per-token" },
  { value: "hermes:gpt-4o", label: "GPT-4o", group: "Hermes · Copilot" },
  { value: "hermes:gpt-4o-mini", label: "GPT-4o-mini", group: "Hermes · Copilot" },
  { value: "hermes:o4-mini", label: "o4-mini", group: "Hermes · Copilot" },
];

function parseBrain(v: string): { provider: "claude" | "openai" | "hermes"; model: string } {
  const [p, ...rest] = v.split(":");
  const provider = p === "openai" ? "openai" : p === "hermes" ? "hermes" : "claude";
  return { provider, model: rest.join(":") || "claude-sonnet-4-6" };
}

const SUGGESTIONS = [
  "Give me a fleet status report",
  "What should I optimize first?",
  "Summarize today's activity",
  "Draft a plan for the next sprint",
];

let idc = 0;
const uid = () => `m${Date.now()}-${idc++}`;

export function ConsoleView() {
  const { chat, setChat } = useStore();
  const [input, setInput] = useState("");
  const [brain, setBrain] = useState("claude:claude-sonnet-4-6");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat]);

  function autosize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }

  function appendDictation(text: string) {
    if (!text) return;
    setInput((prev) => (prev ? prev.replace(/\s+$/, "") + " " : "") + text);
    requestAnimationFrame(autosize);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;

    const { provider, model } = parseBrain(brain);
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content,
      ts: Date.now(),
    };
    const assistantId = uid();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      ts: Date.now(),
      model: `${provider}/${model}`,
      streaming: true,
    };

    const history = [...chat, userMsg];
    setChat([...history, assistantMsg]);
    setInput("");
    setBusy(true);
    requestAnimationFrame(autosize);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          provider,
          model,
          hermesProvider: provider === "hermes" ? "copilot" : undefined,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setChat((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setChat((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + "\n\n⚠️ Stream interrupted." }
              : m
          )
        );
      }
    } finally {
      setChat((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m
        )
      );
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const empty = chat.length === 0;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4">
        {empty ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex h-full flex-col items-center justify-center text-center"
          >
            <div className="animate-float relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl glass">
              <Sparkles className="h-9 w-9 text-violet glow-text" />
              <div className="pulse-ring" style={{ background: "#a78bff", opacity: 0.25 }} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Talk to <span className="gradient-text">Claude</span>
            </h2>
            <p className="mt-2 max-w-sm text-sm text-white/45">
              A direct line to the intelligence running your command center.
              Ask anything.
            </p>
            <div className="mt-7 grid w-full max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  onClick={() => send(s)}
                  className="glass glass-hover rounded-xl px-4 py-3 text-left text-sm text-white/70"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="space-y-5 py-2">
            <AnimatePresence initial={false}>
              {chat.map((m) => (
                <Bubble key={m.id} msg={m} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* composer */}
      <div className="pt-2">
        <div className="glass edge-light rounded-2xl p-2.5">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autosize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Message Claude…  (⏎ to send, ⇧⏎ for newline)"
            className="max-h-[180px] w-full resize-none bg-transparent px-3 py-2 text-[15px] text-white placeholder:text-white/30 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <BrainPicker value={brain} onChange={setBrain} />
              {chat.length > 0 && (
                <button
                  onClick={() => setChat([])}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-white/40 hover:text-white/80"
                >
                  <Eraser className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <MicButton
                onResult={appendDictation}
                lang="sv-SE"
                title="Dictate your message"
              />
              {busy ? (
                <button
                  onClick={stop}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose/20 text-rose"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-30"
                  style={{
                    background: "linear-gradient(135deg,#a78bff,#22d3ee)",
                    boxShadow: "0 0 20px rgba(139,123,255,0.45)",
                  }}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
        style={
          isUser
            ? { background: "rgba(255,255,255,0.08)", color: "#fff" }
            : {
                background: "rgba(139,123,255,0.18)",
                border: "1px solid rgba(139,123,255,0.4)",
                color: "#a78bff",
              }
        }
      >
        {isUser ? "You" : <Sparkles className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-white/[0.06] text-white"
            : "glass text-white/90"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
            {msg.content}
          </p>
        ) : msg.content ? (
          <Markdown text={msg.content} />
        ) : (
          <ThinkingDots />
        )}
        {msg.streaming && msg.content && (
          <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-violet align-middle" />
        )}
      </div>
    </motion.div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-violet"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
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
  const [open, setOpen] = useState(false);
  const current = BRAINS.find((b) => b.value === value) ?? BRAINS[1];

  // Group BRAINS by group name in declaration order.
  const groups: Record<string, typeof BRAINS> = {};
  for (const b of BRAINS) (groups[b.group] ||= []).push(b);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/70 hover:text-white"
      >
        <Cpu className="h-3.5 w-3.5 text-violet" />
        <span className="font-mono">{current.label}</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="glass absolute bottom-full z-20 mb-2 w-60 rounded-xl border border-white/10 p-1.5"
            >
              {Object.entries(groups).map(([g, items]) => (
                <div key={g}>
                  <div className="px-2 pb-1 pt-1.5 text-[9px] font-medium uppercase tracking-[0.18em] text-white/35">
                    {g}
                  </div>
                  {items.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => {
                        onChange(m.value);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${
                        m.value === value
                          ? "bg-violet/15 text-white"
                          : "text-white/65 hover:bg-white/5"
                      }`}
                    >
                      <span className="font-mono">{m.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
