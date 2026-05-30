# Mission Control · Agentic OS

A locally-hosted command center for Claude and your AI agent fleet.

Talks to Claude through the local **`claude` CLI** (your subscription — no API
key, no per-token bills). Saves every chat, goal, journal entry, and agent
conversation to your **Obsidian vault** as plain markdown. Voice input
everywhere via the browser's native Web Speech API. Built with **Next.js 16**,
**Tailwind v4**, and **Framer Motion**.

> *"Most people use AI like a calculator. This is a cockpit."*

## What you get

- **Overview** — animated stat counters, neural-throughput chart, fleet-load
  radial gauge, top agents, and a live activity stream.
- **Agent Fleet** — every agent you've defined as a glass card with status,
  load, sparkline. Click any agent → **Control Room**: a streaming chat where
  Claude is loaded with that agent's manifest as the system prompt. The agent
  stays in character. Conversations auto-save under `Agents/<name>/<date>.md`.
- **Claude Console** — a direct streaming line to Claude. Markdown rendering,
  model picker (Opus / Sonnet / Haiku), stop button. Auto-saves to `Chats/`.
- **Goals** — checkbox task lists with progress bars. Saves to `Goals.md`.
- **Journal** — one entry per day, with voice input. `Journal/<date>.md`.
- **Memory** — search across everything in your vault: chats, goals, journal,
  agent conversations, and imported history.
- **Settings** — live config + auto-detection of installed tools + one-click
  import of your ChatGPT export and Claude Code session history.
- **⌘K** command palette · jump anywhere, control anything.
- **Boot animation** because cockpits deserve a boot animation.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

For long-running local hosting:

```bash
npm run build
npm start
```

## Connect your Claude

This uses the local **`claude` CLI** (Claude Code) — not the Anthropic API
directly. You need:

1. `claude` installed and authenticated (run `claude` once interactively)
2. Your Claude subscription (no API key required)

The Settings page tells you whether the CLI is detected.

## Connect your vault

Mission Control writes to a single folder inside your Obsidian vault. Configure
it via `.env.local` in this directory:

```bash
cp .env.example .env.local
# edit .env.local
```

Key vars (all optional, see `.env.example`):

| Var | What | Default |
|---|---|---|
| `OBSIDIAN_VAULT_PATH` | Path to your vault root | (path that exists on author's machine) |
| `AGENTIC_OS_FOLDER` | Subfolder inside the vault | `Agentic OS` |
| `Q_WORKSPACE_PATH` | Where your agent roster lives | `..` (parent of this directory) |
| `CLAUDE_MODEL` | Default model | `claude-sonnet-4-6` |

## Connect your agent fleet (optional)

Mission Control reads `agents/roster.json` from `Q_WORKSPACE_PATH` to populate
the Agent Fleet. The roster should look like:

```json
{
  "agents": [
    {
      "id": "worker-01",
      "name": "Worker",
      "manifest": "agents/worker.md",
      "model": "claude-sonnet",
      "skills": ["coding", "analysis"],
      "hired": "2026-03-24"
    }
  ]
}
```

Each agent's manifest (`worker.md`) becomes Claude's system prompt in that
agent's Control Room. Use a `## Roll` section to define the role concisely.

If no roster is found, Mission Control falls back to a small set of seed agents
so the UI still renders.

## Import your existing AI history

The Settings page has buttons to import:

- **ChatGPT export** — drop a `chatgpt-export-*.jsonl` (from
  [chatgpt.com/#settings](https://chatgpt.com/) → Data Controls → Export) into
  a folder called `Open ai historik` next to this app and click Import.
- **Claude Code sessions** — automatically imported from `~/.claude/projects/`.

Both write to `Imported/` in your vault and become searchable in Memory.

## Daily retrospective

A `scripts/daily-summary.sh` cron-runner is included. At 8pm each day it can
call `/api/daily-summary` which:

- reads today's chats, journal entry, and goals from the vault
- hands them to Claude with a tight retrospective prompt
- writes the result to `Daily Summary/<date>.md`

Install on macOS via the included launchd plist or run it manually from the
button in Settings.

## How it actually works

- **`/api/chat`** spawns `claude -p --output-format stream-json
  --include-partial-messages` and forwards `content_block_delta` text events
  to the browser as plain-text chunks. The user's API key (if set) is
  explicitly stripped so the CLI always uses OAuth/subscription mode.
- **`/api/agents`** reads `roster.json`, parses each manifest's `## Roll`
  section for a one-line role description, and shapes the data into the
  dashboard's `Agent` type. Live tick adds visual liveliness.
- **Control Room** sends `{ agentId, messages }` to `/api/chat`. The route
  resolves the agent's manifest server-side and passes it as the
  `--system-prompt` to the CLI. The agent stays in character.
- **Vault writes** are direct filesystem (`lib/obsidian.ts`) — no plugin
  required, doesn't require Obsidian to be running.
- **Memory search** does a case-insensitive scan over every markdown file in
  the Agentic OS subfolder. Linear scan, but typically under a second.

## Project layout

```
app/                 layout, page, globals.css (design system), api routes
components/          shell (Sidebar, TopBar), views/, UI primitives, AgentCard…
lib/                 types, store, seed data, formatters, obsidian writer,
                     q-agents loader, import pipelines
scripts/             daily-summary.sh
```

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 (CSS `@theme`) ·
Framer Motion · TypeScript.

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Aydin Darchini](https://klarsinnad.se). Pull requests welcome.
