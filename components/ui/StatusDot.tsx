"use client";

import type { AgentStatus } from "@/lib/types";

const COLORS: Record<AgentStatus, string> = {
  active: "#34d399",
  thinking: "#a78bff",
  idle: "#fbbf24",
  paused: "#64748b",
  error: "#fb7185",
};

const LABELS: Record<AgentStatus, string> = {
  active: "Active",
  thinking: "Thinking",
  idle: "Idle",
  paused: "Paused",
  error: "Error",
};

export function StatusDot({
  status,
  size = 9,
  pulse = true,
}: {
  status: AgentStatus;
  size?: number;
  pulse?: boolean;
}) {
  const color = COLORS[status];
  const live = pulse && (status === "active" || status === "thinking");
  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
      title={LABELS[status]}
    >
      {live && (
        <span
          className="pulse-ring"
          style={{ background: color, opacity: 0.5 }}
        />
      )}
      <span
        className="relative inline-block rounded-full"
        style={{
          width: size,
          height: size,
          background: color,
          boxShadow: `0 0 10px ${color}, 0 0 2px ${color}`,
        }}
      />
    </span>
  );
}

export { COLORS as STATUS_COLORS, LABELS as STATUS_LABELS };
