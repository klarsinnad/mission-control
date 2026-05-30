import path from "node:path";

// ── Where Agentic OS persists your Self layer (chats, goals, journal) ──
// Defaults to Aydin's vault; overridable via .env.local for portability.
// Block 8 (setup wizard) will write these for any user automatically.

// "AI Obsidian valv" is Aydin's dedicated AI vault (separate `.obsidian/`
// inside the parent "Obsidian Vault" folder). Other vaults under that
// folder — Aydin, Voltage, Klarsinnad AB, Aydin & Sofia, root — are for
// different life areas and stay untouched.
export const VAULT_PATH =
  process.env.OBSIDIAN_VAULT_PATH ||
  "/Users/aydindarchini/Documents/Obsidian Vault/AI Obsidian valv";

/** Subfolder inside the vault that holds everything this OS writes. */
export const OS_FOLDER = process.env.AGENTIC_OS_FOLDER || "Agentic OS";

/** Absolute path to the Agentic OS folder inside the vault. */
export const OS_ROOT = path.join(VAULT_PATH, OS_FOLDER);

// ── Q workspace (where roster.json + agent manifests live) ─────────
// Defaults to the parent of mission-control/ — i.e. `Agent - workspace`.
// Override via Q_WORKSPACE_PATH for portability.
export const Q_WORKSPACE_PATH =
  process.env.Q_WORKSPACE_PATH || path.resolve(process.cwd(), "..");

