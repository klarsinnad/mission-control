import { promises as fs } from "node:fs";
import path from "node:path";
import { Q_WORKSPACE_PATH } from "./config";

interface RosterEntry {
  id: string;
  name: string;
  manifest?: string;
  model: string;
  skills?: string[];
}

async function loadRoster(): Promise<RosterEntry[]> {
  try {
    const raw = await fs.readFile(
      path.join(Q_WORKSPACE_PATH, "agents/roster.json"),
      "utf8"
    );
    return (JSON.parse(raw) as { agents: RosterEntry[] }).agents ?? [];
  } catch {
    return [];
  }
}

/**
 * Build a system prompt that puts Claude in-character as a specific Q agent.
 * The manifest .md becomes the persona — Claude is told to stay in that role.
 * Returns null if the agent isn't in the roster.
 */
export async function buildAgentSystemPrompt(
  agentId: string
): Promise<{ prompt: string; name: string } | null> {
  const roster = await loadRoster();
  const agent = roster.find((a) => a.id === agentId);
  if (!agent) return null;

  let manifestText = "";
  if (agent.manifest) {
    try {
      manifestText = await fs.readFile(
        path.join(Q_WORKSPACE_PATH, agent.manifest),
        "utf8"
      );
    } catch {
      /* manifest missing — fall back to skills */
    }
  }

  const fallback = agent.skills?.length
    ? `Your specialist skills: ${agent.skills.join(", ")}.`
    : "Describe your function based on your name and what the operator asks.";

  const prompt = `You are **${agent.name}** (codename \`${agent.id}\`), a specialist agent in Aydin's "Q" multi-agent system. The operator is reaching you directly through Mission Control's Control Room — not through Q's orchestrator.

Stay strictly in character as this agent: its scope, voice, and responsibilities as defined in the manifest below. Be concise, direct, and useful within your domain. If asked something outside your scope, say so briefly and suggest which sibling agent is better suited.

The operator writes Swedish and English — match their language.

---

# Agent manifest

${manifestText.trim() || fallback}`;

  return { prompt, name: agent.name };
}
