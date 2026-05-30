"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hexagon } from "lucide-react";
import { useStore } from "@/lib/store";

const LINES = [
  "initializing torus core…",
  "linking agent fleet…",
  "calibrating neural throughput…",
  "establishing Claude uplink…",
  "mission control online.",
];

export function BootSequence() {
  const { booted } = useStore();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setStep((s) => Math.min(s + 1, LINES.length)),
      380
    );
    return () => clearInterval(id);
  }, []);

  return (
    <AnimatePresence>
      {!booted && (
        <motion.div
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#04050a]"
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 18 }}
            className="relative flex h-24 w-24 items-center justify-center"
          >
            <Hexagon
              className="animate-spin-slow absolute h-24 w-24 text-violet"
              strokeWidth={0.75}
            />
            <motion.div
              className="h-4 w-4 rounded-full bg-violet"
              animate={{
                boxShadow: [
                  "0 0 20px #a78bff",
                  "0 0 44px #a78bff",
                  "0 0 20px #a78bff",
                ],
              }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 font-mono text-sm tracking-[0.4em] text-white/80"
          >
            MISSION CONTROL
          </motion.h1>

          <div className="mt-6 h-28 w-72 font-mono text-xs text-emerald/70">
            {LINES.slice(0, step).map((l) => (
              <motion.div
                key={l}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 py-0.5"
              >
                <span className="text-violet">›</span>
                {l}
              </motion.div>
            ))}
          </div>

          {/* progress bar */}
          <div className="mt-2 h-0.5 w-72 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-violet to-cyan"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
