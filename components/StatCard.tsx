"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import { Sparkline } from "./ui/Sparkline";

interface Props {
  label: string;
  value: number;
  format?: (n: number) => string;
  suffix?: string;
  icon: LucideIcon;
  color: string;
  series?: number[];
  delta?: string;
  index?: number;
}

export function StatCard({
  label,
  value,
  format,
  suffix,
  icon: Icon,
  color,
  series,
  delta,
  index = 0,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: "spring", stiffness: 240, damping: 26 }}
      whileHover={{ y: -3 }}
      className="glass glass-hover edge-light group relative overflow-hidden rounded-2xl p-5"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
        style={{ background: color }}
      />
      <div className="relative flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: `${color}1a`,
            border: `1px solid ${color}40`,
            color,
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
        {delta && (
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[11px]"
            style={{ background: `${color}1a`, color }}
          >
            {delta}
          </span>
        )}
      </div>

      <div className="relative mt-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">
          {label}
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <AnimatedNumber
            value={value}
            format={format}
            className="font-mono text-3xl font-semibold tracking-tight text-white"
          />
          {suffix && (
            <span className="text-sm text-white/40">{suffix}</span>
          )}
        </div>
      </div>

      {series && (
        <div className="relative mt-3 h-8">
          <Sparkline
            data={series}
            color={color}
            width={260}
            height={32}
            className="w-full"
          />
        </div>
      )}
    </motion.div>
  );
}
