"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { relativeTime } from "@/lib/format";
import type { EventLevel } from "@/lib/types";

const LEVEL_META: Record<
  EventLevel,
  { color: string; icon: typeof Info }
> = {
  info: { color: "#60a5fa", icon: Info },
  success: { color: "#34d399", icon: CheckCircle2 },
  warn: { color: "#fbbf24", icon: AlertTriangle },
  error: { color: "#fb7185", icon: XCircle },
  thinking: { color: "#a78bff", icon: Sparkles },
};

export function ActivityFeed({ limit = 12 }: { limit?: number }) {
  const { activity } = useStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const items = activity.slice(0, limit);

  return (
    <div className="flex flex-col gap-1.5">
      <AnimatePresence initial={false}>
        {items.map((e) => {
          const meta = LEVEL_META[e.level];
          const Icon = meta.icon;
          return (
            <motion.div
              key={e.id}
              layout
              initial={{ opacity: 0, x: -16, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]"
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: `${meta.color}1a`,
                  color: meta.color,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/75">
                  <span className="font-medium text-white">
                    {e.agentName}
                  </span>{" "}
                  <span className="text-white/55">{e.message}</span>
                </p>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-white/30">
                {relativeTime(e.ts, now)}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
