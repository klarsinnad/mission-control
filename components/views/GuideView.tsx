"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Check, Cloud, CloudOff, Loader2 } from "lucide-react";
import { Markdown } from "../Markdown";
import { GUIDE_MD } from "@/lib/guide-content";

type Save = "idle" | "saving" | "saved" | "error";

export function GuideView() {
  const [save, setSave] = useState<Save>("idle");

  // Sync the latest guide to the vault on first open — keeps `Guide.md`
  // in Obsidian always matching what the dashboard renders.
  useEffect(() => {
    let cancelled = false;
    setSave("saving");
    fetch("/api/guide", { method: "POST" })
      .then((r) => (r.ok ? "saved" : "error"))
      .catch(() => "error")
      .then((s) => {
        if (!cancelled) setSave(s as Save);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-1">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-white/45">
          <BookOpen className="h-4 w-4 text-violet" />
          How this was built · share with anyone
        </div>
        <SaveBadge state={save} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="glass edge-light rounded-2xl p-6 leading-relaxed"
      >
        <Markdown text={GUIDE_MD} />
      </motion.div>
    </div>
  );
}

function SaveBadge({ state }: { state: Save }) {
  const map = {
    idle: { icon: Cloud, text: "Synced to vault as Guide.md", color: "rgba(255,255,255,0.35)" },
    saving: { icon: Loader2, text: "Saving Guide.md…", color: "#a78bff" },
    saved: { icon: Check, text: "Saved Guide.md to vault", color: "#34d399" },
    error: { icon: CloudOff, text: "Save failed", color: "#fb7185" },
  }[state];
  const Icon = map.icon;
  return (
    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: map.color }}>
      <Icon className={`h-3.5 w-3.5 ${state === "saving" ? "animate-spin" : ""}`} />
      {map.text}
    </div>
  );
}
