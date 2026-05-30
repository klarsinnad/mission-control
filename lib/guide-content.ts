// The single source of truth for the "How this was built" guide.
// Rendered in the dashboard's Guide view AND exported as Guide.md to
// the vault (POST /api/guide). Edit here, both update.

export const GUIDE_MD = `# Agentic OS · How it was built

A local **mission control** for Claude and your agent fleet — running on your
laptop, saving everything to your Obsidian vault, talking to Claude through
your subscription instead of an API key. About 60 minutes of building.

> Inspired by Julian/Goldie's "Build Your Own Agentic OS" guide, adapted to
> ground in **your real system**: your Q agents, your vault, your subscription.

## The shape

Four layers, one operator (you):

| Layer | Surface | Where it lives |
|---|---|---|
| 🧠 **Intelligence** | Claude, reached through the local \`claude\` CLI | streaming \`/api/chat\` |
| ⚙️ **Execution** | Your Q agent fleet (Worker, Watchdog, …) | \`agents/roster.json\` + manifests |
| 🌱 **Self** | Goals, Journal, Memory — your context | filesystem under \`Agentic OS/\` |
| 👑 **You** | Mission Operator — set direction, check the dashboard, scale | the browser |

## The key choice that makes the whole thing free

Most "AI dashboard" tutorials assume an Anthropic API key — pay-per-token,
billing surface, a secret to leak. We do not.

\`/api/chat\` spawns the local \`claude\` CLI in non-interactive print mode:

\`\`\`text
claude -p "<prompt>" \\
  --output-format stream-json \\
  --include-partial-messages \\
  --system-prompt "<persona>" \\
  --model claude-sonnet-4-6
\`\`\`

It returns newline-delimited JSON, the route parses \`stream_event\`
\`content_block_delta\` text and forwards it to the browser as a plain text
stream. The CLI uses your logged-in subscription (\`apiKeySource: "none"\`).

No key. No per-token bills. The leaked key in old logs becomes irrelevant.

## What lives in the vault

Everything Mission Control writes lands under
\`<vault>/Agentic OS/\`. JSON sources of truth in \`.data/\`, human-readable
markdown next to them:

- \`Chats/<date>.md\` — Console exchanges, one file per day
- \`Goals.md\` — checkbox task lists with progress (source: \`.data/goals.json\`)
- \`Journal/<date>.md\` — one entry per day (source: \`.data/journal/<date>.json\`)
- \`Agents/<name>/<date>.md\` — Control Room conversations, per agent
- (\`.data/\` is dot-prefixed so Obsidian's file explorer hides it)

The Memory view searches across all of these.

## The agent fleet

Mission Control reads \`agents/roster.json\` from your Q workspace at startup
and renders each agent as a card with its real role description (from the
\`## Roll\` section of its manifest .md). Clicking **Open Control Room** opens
a chat where Claude is loaded with that agent's manifest as the system
prompt — Worker stays in Worker's voice, Watchdog stays in Watchdog's.

## Voice everywhere

The microphone button uses the browser's native Web Speech API
(\`webkitSpeechRecognition\` / \`SpeechRecognition\`). No API key, no service.
Tap → it pulses rose → speech becomes text → final segments append to the
field. Available in Console, Goals, Journal, Memory, and every Control Room.

## Running it on another machine

1. \`npm install\` in \`mission-control/\`
2. Make sure \`claude\` (Claude Code CLI) is installed and logged in
   (\`claude\` once in a terminal authenticates)
3. \`cp .env.example .env.local\` and set:
   \`\`\`
   OBSIDIAN_VAULT_PATH=/path/to/your/vault
   Q_WORKSPACE_PATH=/path/to/your/Agent\\ -\\ workspace
   \`\`\`
4. \`npm run dev\` → http://localhost:3000
5. The Settings page tells you what is and isn't configured.

That is the whole loop.

## Where you go from here

- The Sidebar groups every surface — Overview, Agent Fleet, Console, Goals, Journal, Memory, Activity, Settings.
- \`⌘K\` opens the command palette — jump anywhere or pause/inspect any agent.
- The Console and every Control Room save automatically — leave them, come back, the conversation is in your vault.

> "The difference between someone using AI and someone running an AI OS is
> the difference between having a hammer and running a construction
> company." Build something with it.
`;
