"use client";

import { motion } from "framer-motion";

interface Props {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
  delay = 0,
}: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 220, damping: 26 }}
      className={`glass edge-light rounded-2xl p-5 ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-sm font-semibold tracking-tight text-white">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-white/40">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </motion.section>
  );
}
