import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import {
  readNote,
  writeNote,
  readJson,
  todayStamp,
} from "@/lib/obsidian";
import type { Goal } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Daily retro ────────────────────────────────────────────────────
// Pulls today's chats + journal + goals from the vault, hands them to
// Claude, gets a short retro back, and saves it under `Daily Summary/`.
// Triggerable manually (button in Settings) or by cron at 20:00.

const CLAUDE_BIN = process.env.CLAUDE_CLI_PATH || "claude";

function pct(g: Goal): number {
  if (!g.tasks.length) return 0;
  return Math.round((g.tasks.filter((t) => t.done).length / g.tasks.length) * 100);
}

async function buildContext(date: string): Promise<string> {
  const chat = await readNote(`Chats/${date}.md`);
  const journal = await readNote(`Journal/${date}.md`);
  const goals = await readJson<Goal[]>(".data/goals.json", []);

  const parts: string[] = [];
  if (chat) parts.push(`# Today's Console chats\n\n${chat}`);
  if (journal) parts.push(`# Today's journal\n\n${journal}`);
  if (goals.length) {
    parts.push(
      `# Current goals\n\n` +
        goals
          .map(
            (g) =>
              `- **${g.title}** (${pct(g)}%${g.category ? ` · ${g.category}` : ""})\n` +
              g.tasks
                .map((t) => `  - [${t.done ? "x" : " "}] ${t.text}`)
                .join("\n")
          )
          .join("\n\n")
    );
  }
  if (!parts.length) parts.push("(No activity logged in the vault today.)");
  return parts.join("\n\n---\n\n");
}

const SYSTEM_PROMPT = `You are Mission Control writing a short daily retrospective for the operator (Aydin). The operator is Swedish — write in Swedish unless the day's content is overwhelmingly English. Be sharp, honest, and concise. No filler. Structure:

**Vad rörde sig framåt.** One sentence.
**Vad fastnade.** One sentence. Skip if nothing.
**En insikt jag inte ska tappa.** One sentence.
**En sak att börja imorgon.** One concrete action.

Maximum 180 words total. End with nothing else.`;

function runClaude(prompt: string): Promise<{ text: string; error?: string }> {
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
          process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
          "--system-prompt",
          SYSTEM_PROMPT,
        ],
        { cwd: os.tmpdir(), env }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "spawn failed";
      resolve({ text: "", error: msg });
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
        else resolve({ text: "", error: errBuf.trim() || "no result text" });
      } catch {
        resolve({ text: "", error: errBuf.trim() || "non-JSON output" });
      }
    });
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayStamp();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "bad date" }, { status: 400 });
  }

  const context = await buildContext(date);
  const prompt = `Här är allt jag gjorde i Mission Control ${date}. Skriv min korta retro enligt mallen.\n\n${context}`;

  const { text, error } = await runClaude(prompt);
  if (!text) {
    return Response.json(
      { ok: false, error: error || "Empty summary" },
      { status: 500 }
    );
  }

  const rel = path.join("Daily Summary", `${date}.md`);
  const md = `---\ndate: ${date}\ntags: [agentic-os, daily-summary]\n---\n\n# Daily Summary · ${date}\n\n${text.trim()}\n`;
  await writeNote(rel, md);

  return Response.json({ ok: true, date, file: rel, summary: text.trim() });
}

export async function GET() {
  return Response.json({
    info: "POST to generate today's summary, or POST ?date=YYYY-MM-DD for any day.",
  });
}
