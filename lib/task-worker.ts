import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { readJson, writeJson, todayStamp, timeStamp, writeNote } from "./obsidian";
import { buildAgentSystemPrompt } from "./q-agents";
import { runHermes } from "./hermes";
import { runOpenAI } from "./openai-chat";
import type { Task } from "./types";

// ── Background task worker ─────────────────────────────────────────
// Runs inside the Next.js Node process (started by instrumentation.ts).
// Polls `.data/tasks.json` for queued background tasks and executes
// them one at a time through the `claude` CLI. Status updates persist
// to the same JSON so the UI can poll and see them live.

const TASKS_JSON = ".data/tasks.json";
const CLAUDE_BIN = process.env.CLAUDE_CLI_PATH || "claude";
const POLL_MS = 3000;
const ERROR_BACKOFF_MS = 15_000;

const DEFAULT_SYSTEM = `You are Mission Control's task executor running autonomously while the operator is away. The operator queued this and won't see it until it's done — so deliver something that's worth waking up to.

Structure:
1. Restate the task in one line.
2. Spend real thought on it. Show your work where it helps.
3. Deliver the actual artefact (article, plan, analysis, list — whatever the task asked for).
4. End with one line: what's next if the operator wants to continue.

Write Swedish if the task is in Swedish. No filler.`;

declare global {
  // eslint-disable-next-line no-var
  var __mcTaskWorker: { started: boolean } | undefined;
}

function slug(s: string, max = 60): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "task"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function updateTaskById(
  id: string,
  patch: Partial<Task>
): Promise<Task | null> {
  const tasks = await readJson<Task[]>(TASKS_JSON, []);
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  tasks[idx] = { ...tasks[idx], ...patch };
  await writeJson(TASKS_JSON, tasks);
  return tasks[idx];
}

function runClaude(
  prompt: string,
  systemPrompt: string,
  model: string,
  effort: string
): Promise<{ text: string; error?: string; durationMs: number }> {
  const started = Date.now();
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    let child;
    try {
      child = spawn(
        CLAUDE_BIN,
        [
          "-p",
          prompt,
          "--output-format",
          "json",
          "--model",
          model,
          "--system-prompt",
          systemPrompt,
          "--effort",
          effort,
        ],
        { cwd: os.tmpdir(), env }
      );
    } catch (err) {
      resolve({
        text: "",
        error: err instanceof Error ? err.message : "spawn failed",
        durationMs: 0,
      });
      return;
    }
    let out = "";
    let errBuf = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (errBuf += d.toString()));
    child.on("close", () => {
      const durationMs = Date.now() - started;
      try {
        const parsed = JSON.parse(out);
        const text =
          typeof parsed.result === "string" ? parsed.result : "";
        resolve(
          text
            ? { text, durationMs }
            : { text: "", error: errBuf.trim() || "empty result", durationMs }
        );
      } catch {
        resolve({
          text: "",
          error: errBuf.trim() || "non-JSON output",
          durationMs,
        });
      }
    });
  });
}

async function saveTaskNote(task: Task, durationMs: number): Promise<void> {
  const date = todayStamp(new Date(task.createdAt));
  const rel = path.join("Tasks", `${date}-${slug(task.title)}.md`);
  const agentLine = task.agentName ? `\nagent: ${task.agentName}` : "";
  const durationMin =
    durationMs > 0 ? `${Math.round(durationMs / 6000) / 10} min` : "—";

  const md = `---
title: ${JSON.stringify(task.title)}
date: ${date}
time: ${timeStamp(new Date(task.createdAt))}${agentLine}
mode: ${task.mode}
status: ${task.status}
model: ${task.model}
effort: ${task.effort ?? "medium"}
duration: ${durationMin}
tags: [agentic-os, task, background]
---

# ${task.title}

**Task:**
${task.description.trim()}

**Result:**
${task.result?.trim() || "(no result)"}
${task.error ? `\n**Error:** ${task.error}\n` : ""}
`;
  await writeNote(rel, md);
}

/** Pick up one queued background task and run it. Returns true if one was processed. */
async function processOne(): Promise<boolean> {
  const tasks = await readJson<Task[]>(TASKS_JSON, []);
  const queued = tasks.find(
    (t) => t.status === "queued" && t.mode === "background"
  );
  if (!queued) return false;

  // Mark running.
  await updateTaskById(queued.id, {
    status: "running",
    startedAt: Date.now(),
  });

  // System prompt: agent manifest if specified, else default.
  let systemPrompt = DEFAULT_SYSTEM;
  if (queued.agentId) {
    const agent = await buildAgentSystemPrompt(queued.agentId);
    if (agent) {
      systemPrompt = agent.prompt + "\n\n---\n\n" + DEFAULT_SYSTEM;
    }
  }

  let result: { text: string; error?: string; durationMs: number };
  if (queued.provider === "hermes") {
    const started = Date.now();
    const r = await runHermes({
      prompt: queued.description,
      systemPrompt,
      provider: queued.hermesProvider || "copilot",
      model: queued.model,
      timeoutMs: 600_000,
    });
    result = { ...r, durationMs: Date.now() - started };
  } else if (queued.provider === "openai") {
    const started = Date.now();
    const r = await runOpenAI({
      prompt: queued.description,
      systemPrompt,
      model: queued.model,
      maxOutputTokens: 4096,
    });
    result = { ...r, durationMs: Date.now() - started };
  } else {
    result = await runClaude(
      queued.description,
      systemPrompt,
      queued.model,
      queued.effort || "high"
    );
  }
  const { text, error, durationMs } = result;

  const finished = await updateTaskById(queued.id, {
    status: text ? "done" : "failed",
    result: text || undefined,
    error: error || undefined,
    finishedAt: Date.now(),
  });

  if (finished) {
    try {
      await saveTaskNote(finished, durationMs);
    } catch {
      /* don't crash on vault failure */
    }
  }
  return true;
}

async function workerLoop(): Promise<void> {
  console.log("[task-worker] started");
  for (;;) {
    try {
      const processed = await processOne();
      await sleep(processed ? 500 : POLL_MS);
    } catch (err) {
      console.error("[task-worker] iteration error:", err);
      await sleep(ERROR_BACKOFF_MS);
    }
  }
}

export function startTaskWorker(): void {
  if (globalThis.__mcTaskWorker?.started) return;
  globalThis.__mcTaskWorker = { started: true };
  workerLoop().catch((err) =>
    console.error("[task-worker] crashed:", err)
  );
}
