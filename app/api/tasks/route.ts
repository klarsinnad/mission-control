import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import {
  readJson,
  writeJson,
  writeNote,
  todayStamp,
  timeStamp,
} from "@/lib/obsidian";
import { buildAgentSystemPrompt } from "@/lib/q-agents";
import { runHermes } from "@/lib/hermes";
import { runOpenAI } from "@/lib/openai-chat";
import type { Task, TaskProvider } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TASKS_JSON = ".data/tasks.json";
const CLAUDE_BIN = process.env.CLAUDE_CLI_PATH || "claude";

const DEFAULT_SYSTEM = `You are Mission Control's task executor. The operator has handed you a discrete task. Be direct and structured:

1. Restate the task in one line.
2. Execute it — give the actual deliverable, not a plan.
3. End with one line: what would unblock the next step (if anything).

Write Swedish if the task is in Swedish. Be concise.`;

function uid(): string {
  return `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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

async function runWithClaude(
  prompt: string,
  systemPrompt: string,
  model: string
): Promise<{ text: string; error?: string }> {
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
        ],
        { cwd: os.tmpdir(), env }
      );
    } catch (err) {
      resolve({
        text: "",
        error: err instanceof Error ? err.message : "spawn failed",
      });
      return;
    }
    let out = "";
    let errBuf = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (errBuf += d.toString()));
    child.on("close", () => {
      try {
        const parsed = JSON.parse(out);
        const text = typeof parsed.result === "string" ? parsed.result : "";
        if (text) resolve({ text });
        else resolve({ text: "", error: errBuf.trim() || "empty result" });
      } catch {
        resolve({ text: "", error: errBuf.trim() || "non-JSON output" });
      }
    });
  });
}

async function saveTaskNote(task: Task): Promise<void> {
  const date = todayStamp(new Date(task.createdAt));
  const rel = path.join("Tasks", `${date}-${slug(task.title)}.md`);
  const agentLine = task.agentName ? `\nagent: ${task.agentName}` : "";
  const md = `---
title: ${JSON.stringify(task.title)}
date: ${date}
time: ${timeStamp(new Date(task.createdAt))}${agentLine}
status: ${task.status}
model: ${task.model}
tags: [agentic-os, task]
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

export async function GET() {
  const tasks = await readJson<Task[]>(TASKS_JSON, []);
  return Response.json({ tasks });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    title: string;
    description: string;
    agentId?: string;
    model?: string;
    provider?: TaskProvider;
    hermesProvider?: string;
    mode?: "sync" | "background";
    effort?: string;
  };

  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  if (!title || !description) {
    return Response.json({ error: "title and description required" }, { status: 400 });
  }

  const mode = body.mode === "background" ? "background" : "sync";
  const provider: TaskProvider =
    body.provider === "hermes"
      ? "hermes"
      : body.provider === "openai"
      ? "openai"
      : "claude";
  // Default model depends on provider.
  let chosenModel =
    body.model ||
    (provider === "hermes" || provider === "openai"
      ? "gpt-4o"
      : process.env.CLAUDE_MODEL || "claude-sonnet-4-6");
  const hermesProvider = body.hermesProvider || "copilot";
  let agentName: string | undefined;
  if (body.agentId) {
    const a = await buildAgentSystemPrompt(body.agentId);
    if (a) agentName = a.name;
  }

  // Background mode: enqueue and return immediately. The worker picks it up.
  if (mode === "background") {
    const tasks = await readJson<Task[]>(TASKS_JSON, []);
    const task: Task = {
      id: uid(),
      title,
      description,
      agentId: body.agentId,
      agentName,
      status: "queued",
      mode: "background",
      provider,
      hermesProvider: provider === "hermes" ? hermesProvider : undefined,
      model: chosenModel,
      effort: body.effort || "high",
      createdAt: Date.now(),
    };
    tasks.unshift(task);
    await writeJson(TASKS_JSON, tasks);
    return Response.json({ task });
  }

  // Synchronous mode: run inline, return when done.
  let systemPrompt = DEFAULT_SYSTEM;
  if (body.agentId) {
    const a = await buildAgentSystemPrompt(body.agentId);
    if (a) systemPrompt = a.prompt;
  }

  const tasks = await readJson<Task[]>(TASKS_JSON, []);
  const task: Task = {
    id: uid(),
    title,
    description,
    agentId: body.agentId,
    agentName,
    status: "running",
    mode: "sync",
    provider,
    hermesProvider: provider === "hermes" ? hermesProvider : undefined,
    model: chosenModel,
    createdAt: Date.now(),
  };
  tasks.unshift(task);
  await writeJson(TASKS_JSON, tasks);

  const { text, error } =
    provider === "hermes"
      ? await runHermes({
          prompt: description,
          systemPrompt,
          provider: hermesProvider,
          model: chosenModel,
        })
      : provider === "openai"
      ? await runOpenAI({
          prompt: description,
          systemPrompt,
          model: chosenModel,
        })
      : await runWithClaude(description, systemPrompt, chosenModel);
  task.status = text ? "done" : "failed";
  task.result = text;
  task.error = error;
  task.finishedAt = Date.now();

  // Persist updated task (find by id; same array still in memory).
  const fresh = await readJson<Task[]>(TASKS_JSON, []);
  const idx = fresh.findIndex((t) => t.id === task.id);
  if (idx >= 0) fresh[idx] = task;
  else fresh.unshift(task);
  await writeJson(TASKS_JSON, fresh);

  await saveTaskNote(task).catch(() => {
    /* vault write failure shouldn't fail the API */
  });

  return Response.json({ task });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const tasks = await readJson<Task[]>(TASKS_JSON, []);
  await writeJson(
    TASKS_JSON,
    tasks.filter((t) => t.id !== id)
  );
  return Response.json({ ok: true });
}
