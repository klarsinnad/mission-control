"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowUp, Square, Sparkles, Eraser } from "lucide-react";
import { Markdown } from "./Markdown";
import { MicButton } from "./MicButton";
import { StatusDot, STATUS_LABELS } from "./ui/StatusDot";
import type { Agent, ChatMessage } from "@/lib/types";

let counter = 0;
const uid = () => `cr${Date.now()}-${counter++}`;

interface Props {
  agent: Agent | null;
  onClose: () => void;
}

/**
 * Direct streaming chat with one Q agent. The server loads that agent's
 * manifest as the system prompt, so Claude stays strictly in character
 * as that agent (Worker, Memory Architect, Watchdog, etc.). Exchanges
 * auto-save under `Agentic OS/Agents/<agent>/<date>.md`.
 */
export function ControlRoom({ agent, onClose }: Props) {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (agent) {
      setChat([]);
      setInput("");
      setTimeout(() => taRef.current?.focus(), 80);
    }
  }, [agent?.id]);

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
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }

  function appendDictation(text: string) {
    if (!text) return;
    setInput((p) => (p ? p.replace(/\s+$/, "") + " " : "") + text);
    requestAnimationFrame(autosize);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy || !agent) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content, ts: Date.now() };
    const assistantId = uid();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      ts: Date.now(),
      model: agent.model,
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
          agentId: agent.id,
          model: agent.model,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.body) throw new Error("No stream");
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
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
      );
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <AnimatePresence>
      {agent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="glass edge-light relative flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10"
            style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
          >
            {/* header */}
            <div
              className="relative flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4"
              style={{
                background: `linear-gradient(90deg, ${agent.accent}1a, transparent 60%)`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold"
                  style={{
                    background: `${agent.accent}22`,
                    border: `1px solid ${agent.accent}66`,
                    color: agent.accent,
                    boxShadow: `0 0 20px ${agent.accent}33`,
                  }}
                >
                  {agent.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[15px] font-semibold text-white">
                    {agent.name}
                    <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                      Control Room
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                    <StatusDot status={agent.status} />
                    {STATUS_LABELS[agent.status]} · {agent.codename} · {agent.model}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {chat.length > 0 && (
                  <button
                    onClick={() => setChat([])}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-white/40 hover:text-white/80"
                  >
                    <Eraser className="h-3.5 w-3.5" /> Clear
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="glass-hover flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
              {chat.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Sparkles
                    className="mb-3 h-7 w-7"
                    style={{ color: agent.accent }}
                  />
                  <p className="max-w-md text-sm text-white/55">{agent.task}</p>
                  <p className="mt-3 text-[11px] text-white/30">
                    Direct line · this agent stays in role · saves to your vault
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chat.map((m) => (
                    <Bubble key={m.id} msg={m} accent={agent.accent} />
                  ))}
                </div>
              )}
            </div>

            {/* composer */}
            <div className="border-t border-white/8 p-3">
              <div className="glass edge-light rounded-2xl p-2">
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
                    if (e.key === "Escape") onClose();
                  }}
                  rows={1}
                  placeholder={`Brief ${agent.name}…`}
                  className="max-h-[160px] w-full resize-none bg-transparent px-3 py-2 text-[15px] text-white placeholder:text-white/30 focus:outline-none"
                />
                <div className="flex items-center justify-end gap-2 px-1">
                  <MicButton onResult={appendDictation} title="Dictate" />
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
                        background: `linear-gradient(135deg, ${agent.accent}, #22d3ee)`,
                        boxShadow: `0 0 20px ${agent.accent}55`,
                      }}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Bubble({ msg, accent }: { msg: ChatMessage; accent: string }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold"
        style={
          isUser
            ? { background: "rgba(255,255,255,0.08)", color: "#fff" }
            : {
                background: `${accent}1f`,
                border: `1px solid ${accent}55`,
                color: accent,
              }
        }
      >
        {isUser ? "You" : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
          isUser ? "bg-white/[0.06] text-white" : "glass text-white/90"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">
            {msg.content}
          </p>
        ) : msg.content ? (
          <Markdown text={msg.content} />
        ) : (
          <ThinkingDots accent={accent} />
        )}
        {msg.streaming && msg.content && (
          <span
            className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse align-middle"
            style={{ background: accent }}
          />
        )}
      </div>
    </motion.div>
  );
}

function ThinkingDots({ accent }: { accent: string }) {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: accent }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}
