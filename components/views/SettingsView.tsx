"use client";

import { useEffect, useState } from "react";
import {
  Plug,
  Check,
  Copy,
  Database,
  FolderTree,
  Boxes,
  Wrench,
  X,
  Cpu,
  ShieldCheck,
  Download,
  Loader2,
} from "lucide-react";
import { Panel } from "../ui/Panel";

interface ToolStatus {
  name: string;
  installed: boolean;
  path?: string;
  version?: string;
}

interface ConfigState {
  paths: {
    vault: string;
    vaultExists: boolean;
    osFolder: string;
    osRoot: string;
    osRootExists: boolean;
    qWorkspace: string;
    qWorkspaceExists: boolean;
  };
  overrides: Record<string, boolean>;
  defaultModel: string;
  tools: { claude: ToolStatus; openclaw: ToolStatus; hermes: ToolStatus };
  agentsInRoster: number;
}

export function SettingsView() {
  const [cfg, setCfg] = useState<ConfigState | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => setCfg(null));
  }, []);

  const claudeLinked = cfg?.tools.claude.installed;

  function copy(text: string, tag: string) {
    navigator.clipboard?.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied(null), 1400);
  }

  const envTemplate = `# Mission Control · Agentic OS overrides
# Drop these into .env.local in mission-control/ and restart the dev server.

# Where your Self layer (chats, goals, journal, agent chats) is written.
# OBSIDIAN_VAULT_PATH=${cfg?.paths.vault ?? "/path/to/your/vault"}
# AGENTIC_OS_FOLDER=${cfg?.paths.osFolder ?? "Agentic OS"}

# Where roster.json + agent manifests live (defaults to ../ of mission-control).
# Q_WORKSPACE_PATH=${cfg?.paths.qWorkspace ?? "/path/to/Agent - workspace"}

# Override the claude CLI binary (rare).
# CLAUDE_CLI_PATH=/Users/you/.nvm/.../bin/claude

# Default model for the Console (overridable in the UI).
# CLAUDE_MODEL=${cfg?.defaultModel ?? "claude-sonnet-4-6"}
`;

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
      {/* Claude link */}
      <Panel title="Claude Connection" className="md:col-span-2">
        <div className="flex flex-wrap items-center gap-4">
          <Halo on={!!claudeLinked} icon={Plug} />
          <div className="flex-1">
            <div className="flex items-center gap-2 text-white">
              <span className="font-semibold">
                {claudeLinked ? "Linked via CLI · subscription mode" : "Claude CLI offline"}
              </span>
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                style={{
                  background: claudeLinked ? "rgba(52,211,153,0.15)" : "rgba(251,113,133,0.15)",
                  color: claudeLinked ? "#34d399" : "#fb7185",
                }}
              >
                {cfg?.tools.claude.installed ? "live" : "offline"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-white/45">
              {claudeLinked
                ? `${cfg?.tools.claude.version ?? "claude"} · no API key, no per-token bills · default model ${cfg?.defaultModel}`
                : "Run `claude` once in a terminal to authenticate, then refresh."}
            </p>
          </div>
        </div>
      </Panel>

      {/* Vault */}
      <Panel title="Obsidian Vault" delay={0.06}>
        <div className="space-y-3">
          <PathRow
            icon={Database}
            label="Vault root"
            value={cfg?.paths.vault ?? "…"}
            ok={cfg?.paths.vaultExists}
            override={cfg?.overrides.OBSIDIAN_VAULT_PATH}
          />
          <PathRow
            icon={FolderTree}
            label="Self folder"
            value={cfg?.paths.osRoot ?? "…"}
            ok={cfg?.paths.osRootExists}
            sub={`subfolder: ${cfg?.paths.osFolder ?? "—"}`}
            override={cfg?.overrides.AGENTIC_OS_FOLDER}
          />
        </div>
      </Panel>

      {/* Q workspace */}
      <Panel title="Q Workspace" delay={0.08}>
        <div className="space-y-3">
          <PathRow
            icon={Boxes}
            label="Workspace root"
            value={cfg?.paths.qWorkspace ?? "…"}
            ok={cfg?.paths.qWorkspaceExists}
            override={cfg?.overrides.Q_WORKSPACE_PATH}
          />
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
            <span className="text-xs uppercase tracking-[0.18em] text-white/40">
              Agents in roster
            </span>
            <span className="font-mono text-sm text-violet">
              {cfg?.agentsInRoster ?? "—"}
            </span>
          </div>
        </div>
      </Panel>

      {/* Detected tools */}
      <Panel title="Detected Tools" delay={0.1} className="md:col-span-2">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {cfg && (
            <>
              <ToolPill icon={Cpu} t={cfg.tools.claude} />
              <ToolPill icon={Wrench} t={cfg.tools.openclaw} />
              <ToolPill icon={Wrench} t={cfg.tools.hermes} />
            </>
          )}
        </div>
      </Panel>

      {/* Import history */}
      <Panel title="Import External History" delay={0.11} className="md:col-span-2">
        <ImportPanel />
      </Panel>

      {/* Env template */}
      <Panel title="Override via .env.local" delay={0.12} className="md:col-span-2">
        <p className="mb-3 text-xs text-white/40">
          All paths default to Aydin's setup. To run this on another machine,
          drop these into <code className="font-mono text-cyan">mission-control/.env.local</code>{" "}
          and restart the dev server. The Settings page above tells you what&apos;s
          currently active.
        </p>
        <div className="relative">
          <pre className="max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed text-white/75">
            <code>{envTemplate}</code>
          </pre>
          <button
            onClick={() => copy(envTemplate, "env")}
            className="glass-hover absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1.5 text-xs text-white/65"
          >
            {copied === "env" ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy
              </>
            )}
          </button>
        </div>
      </Panel>

      {/* System */}
      <Panel title="System" delay={0.14} className="md:col-span-2">
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Row k="Build" v="Mission Control · Agentic OS v1.0" />
          <Row k="Runtime" v="Next.js 16 · React 19 · Turbopack" />
          <Row k="Claude" v="via local CLI (subscription)" />
          <Row k="Vault layer" v="filesystem write to local vault" />
        </dl>
      </Panel>
    </div>
  );
}

function Halo({ on, icon: Icon }: { on: boolean; icon: typeof Plug }) {
  return (
    <div
      className="flex h-14 w-14 items-center justify-center rounded-2xl"
      style={{
        background: on ? "rgba(52,211,153,0.12)" : "rgba(251,113,133,0.12)",
        border: `1px solid ${on ? "rgba(52,211,153,0.4)" : "rgba(251,113,133,0.4)"}`,
      }}
    >
      <Icon className={on ? "text-emerald" : "text-rose"} />
    </div>
  );
}

function PathRow({
  icon: Icon,
  label,
  value,
  ok,
  sub,
  override,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  ok?: boolean;
  sub?: string;
  override?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-violet" />
          <span className="text-xs uppercase tracking-[0.18em] text-white/40">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {override && (
            <span className="rounded-full bg-violet/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-violet">
              env
            </span>
          )}
          {ok === undefined ? null : ok ? (
            <ShieldCheck className="h-4 w-4 text-emerald" />
          ) : (
            <X className="h-4 w-4 text-rose" />
          )}
        </div>
      </div>
      <div className="mt-1 truncate font-mono text-[11px] text-white/65">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-white/35">{sub}</div>}
    </div>
  );
}

function ToolPill({ icon: Icon, t }: { icon: typeof Cpu; t: ToolStatus }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
      style={{
        borderColor: t.installed ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)",
        background: t.installed ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.02)",
      }}
    >
      <Icon className={`h-4 w-4 ${t.installed ? "text-emerald" : "text-white/30"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          {t.name}
          {t.installed ? (
            <Check className="h-3.5 w-3.5 text-emerald" />
          ) : (
            <X className="h-3.5 w-3.5 text-rose" />
          )}
        </div>
        <div className="truncate font-mono text-[10px] text-white/40">
          {t.version || (t.installed ? "installed" : "not found on PATH")}
        </div>
      </div>
    </div>
  );
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  error?: string;
}

function ImportPanel() {
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, ImportResult> | null>(null);

  async function run(source: "all" | "chatgpt" | "claude") {
    setRunning(source);
    setResult(null);
    try {
      const r = await fetch(`/api/import?source=${source}`, { method: "POST" });
      const d = await r.json();
      setResult(d);
    } catch {
      setResult({ error: { imported: 0, skipped: 0, total: 0, error: "Network error" } });
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">
        Pull your full ChatGPT export and every Claude Code session into the
        vault as searchable markdown notes. Idempotent — re-runs only import
        new items. Currently Memory searches everything you import here.
      </p>
      <div className="flex flex-wrap gap-2">
        <ImportButton
          label="Import everything"
          desc="ChatGPT + Claude sessions"
          loading={running === "all"}
          disabled={!!running}
          onClick={() => run("all")}
          primary
        />
        <ImportButton
          label="ChatGPT only"
          desc="from Open ai historik/"
          loading={running === "chatgpt"}
          disabled={!!running}
          onClick={() => run("chatgpt")}
        />
        <ImportButton
          label="Claude sessions only"
          desc="from ~/.claude/projects/"
          loading={running === "claude"}
          disabled={!!running}
          onClick={() => run("claude")}
        />
      </div>
      {result && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {Object.entries(result).map(([k, v]) => (
            <ResultRow key={k} source={k} r={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function ImportButton({
  label,
  desc,
  loading,
  disabled,
  onClick,
  primary,
}: {
  label: string;
  desc: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-40"
      style={
        primary
          ? {
              background: "linear-gradient(135deg,#a78bff,#22d3ee)",
              color: "white",
              boxShadow: "0 0 18px rgba(139,123,255,0.4)",
            }
          : {
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.85)",
            }
      }
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      <div className="text-left">
        <div>{label}</div>
        <div className={`text-[10px] ${primary ? "text-white/70" : "text-white/40"}`}>{desc}</div>
      </div>
    </button>
  );
}

function ResultRow({ source, r }: { source: string; r: ImportResult }) {
  const ok = !r.error;
  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{
        borderColor: ok ? "rgba(52,211,153,0.25)" : "rgba(251,113,133,0.25)",
        background: ok ? "rgba(52,211,153,0.05)" : "rgba(251,113,133,0.05)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
          {source}
        </span>
        {ok ? (
          <Check className="h-3.5 w-3.5 text-emerald" />
        ) : (
          <X className="h-3.5 w-3.5 text-rose" />
        )}
      </div>
      <div className="mt-1 font-mono text-xs text-white/80">
        {ok ? (
          <>
            +{r.imported} new · {r.skipped} skipped · {r.total} seen
          </>
        ) : (
          <>{r.error}</>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2">
      <dt className="text-white/40">{k}</dt>
      <dd className="font-mono text-xs text-white/75">{v}</dd>
    </div>
  );
}
