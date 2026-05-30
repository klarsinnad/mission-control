export type AgentStatus = "active" | "idle" | "thinking" | "paused" | "error";

export type AgentKind =
  | "orchestrator"
  | "researcher"
  | "coder"
  | "analyst"
  | "guardian"
  | "scribe";

export interface Agent {
  id: string;
  name: string;
  codename: string;
  kind: AgentKind;
  model: string;
  status: AgentStatus;
  /** 0–100 current load */
  load: number;
  /** tasks completed lifetime */
  completed: number;
  /** tokens used this session */
  tokens: number;
  task: string;
  uptimeMins: number;
  accent: string; // hex
  /** recent activity series for the sparkline (0–100) */
  series: number[];
}

export type EventLevel = "info" | "success" | "warn" | "error" | "thinking";

export interface ActivityEvent {
  id: string;
  ts: number;
  agentId: string;
  agentName: string;
  level: EventLevel;
  message: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
  model?: string;
  streaming?: boolean;
}

export type ViewId =
  | "dashboard"
  | "agents"
  | "console"
  | "goals"
  | "journal"
  | "memory"
  | "tasks"
  | "studio"
  | "workspace"
  | "sessions"
  | "seo"
  | "activity"
  | "guide"
  | "settings";

export type TaskStatus = "queued" | "running" | "done" | "failed";
export type TaskMode = "sync" | "background";

export type TaskProvider = "claude" | "hermes" | "openai";

export interface Task {
  id: string;
  title: string;
  description: string;
  agentId?: string;
  agentName?: string;
  status: TaskStatus;
  mode: TaskMode;            // "sync" runs inline; "background" runs in the worker
  result?: string;
  error?: string;
  provider?: TaskProvider;   // routing: "claude" (CLI on subscription) | "hermes" (CLI via copilot/etc)
  hermesProvider?: string;   // when provider=hermes: copilot | openai | openrouter | …
  model: string;
  effort?: string;           // low | medium | high | xhigh — gives Claude more thinking time
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface GoalTask {
  id: string;
  text: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  category: string;
  tasks: GoalTask[];
  createdAt: number;
}
