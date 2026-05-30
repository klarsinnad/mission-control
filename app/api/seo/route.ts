import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { writeNote, listNotes, readNote, todayStamp } from "@/lib/obsidian";
import { buildAgentSystemPrompt } from "@/lib/q-agents";
import { runOpenAI } from "@/lib/openai-chat";
import { runHermes } from "@/lib/hermes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CLAUDE_BIN = process.env.CLAUDE_CLI_PATH || "claude";

// Default to Content Formatter — Q's agent for "protocol article pipeline".
const DEFAULT_AGENT_ID = "content-formatter-01";

const ARTICLE_SYSTEM = `You are writing a peptide / supplement / longevity article for the Kangaroo Peptides Kunskapsbank (kangaroopeptides.com).

Style:
- Swedish
- Confident, scientifically grounded, no fluff or hedging
- Specific molecule and peptide names (BPC-157, CJC-1295, NAD+, etc.)
- No marketing language, no AI clichés
- Use \`<em>emphasis</em>\` HTML in the H1 for ONE key word

Required structure (in this order):
1. \`# <Rubrik med <em>emphasis</em>>\`
2. Ingress — 2–4 meningar som etablerar ämnet
3. 4–8 \`## H2\` sections covering: mekanism, evidens, dosering, biverkningar, för vem, referenser
4. \`## Vanliga frågor\` (4–5 Q&A)

Output ONLY the article markdown. No preamble, no closing note.`;

const META_SYSTEM = `You generate JavaScript snippets that wire a Kunskapsbank article into the Kangaroo Peptides codebase.

The schema is exact. Two snippets:

\`\`\`javascript
// 1. PROTOCOLS entry
{
  id: '<slug>',         // lowercase ASCII, dashes, no åäö (ö→o, ä→a, å→a)
  title: '<rubrik>',
  kicker: '<2-3 word category>',
  subtitle: '<one sentence describing the article>',
  tags: ['<lowercase search terms>'],
  products: ['<canonical product names that exist in our store>']
}
\`\`\`

\`\`\`javascript
// 2. PROTOCOL_TAXONOMY entry
'<slug>': {
  conditions: ['<diseases / states>'],
  problems: ['<biological mechanisms>'],
  compounds: ['<every peptide, drug, molecule named in the article>'],
  topics: ['<pathways, receptors, axes>']
}
\`\`\`

Be exhaustive in taxonomy — anyone who could search for this article must find it. All taxonomy values lowercase.

Output the two snippets in that order, in JS code fences. Nothing else.`;

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/ö/g, "o")
    .replace(/ä/g, "a")
    .replace(/å/g, "a")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function runBrain(
  provider: "claude" | "openai" | "hermes",
  prompt: string,
  systemPrompt: string,
  model: string,
  hermesProvider?: string
): Promise<{ text: string; error?: string }> {
  if (provider === "openai") {
    return runOpenAI({ prompt, systemPrompt, model, maxOutputTokens: 4096 });
  }
  if (provider === "hermes") {
    return runHermes({
      prompt,
      systemPrompt,
      provider: hermesProvider || "copilot",
      model,
      timeoutMs: 240_000,
    });
  }
  return runClaude(prompt, systemPrompt, model);
}

async function runClaude(
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
      resolve({ text: "", error: err instanceof Error ? err.message : "spawn failed" });
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
        resolve(text ? { text } : { text: "", error: errBuf || "empty" });
      } catch {
        resolve({ text: "", error: errBuf || "non-json" });
      }
    });
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    mode: "article" | "meta";
    keyword?: string;
    instructions?: string;
    article?: string;
    productNames?: string;
    agentId?: string;
    provider?: "claude" | "openai" | "hermes";
    hermesProvider?: string;
    model?: string;
  };

  const provider: "claude" | "openai" | "hermes" =
    body.provider === "openai"
      ? "openai"
      : body.provider === "hermes"
      ? "hermes"
      : "claude";
  const model =
    body.model ||
    (provider === "claude" ? "claude-sonnet-4-6" : "gpt-4o");

  // Compose the system prompt: optionally append the Q-agent's manifest.
  const agentId = body.agentId || DEFAULT_AGENT_ID;
  const agent = await buildAgentSystemPrompt(agentId);
  const agentBlock = agent
    ? `\n\n---\n\n# Agent context\n\nYou speak as ${agent.name} — additional context below.\n\n${agent.prompt}`
    : "";

  if (body.mode === "article") {
    const keyword = (body.keyword ?? "").trim();
    if (!keyword) {
      return Response.json({ error: "keyword required" }, { status: 400 });
    }
    const prompt =
      `Topic: ${keyword}` +
      (body.instructions ? `\n\nExtra direction: ${body.instructions.trim()}` : "");

    const { text, error } = await runBrain(
      provider,
      prompt,
      ARTICLE_SYSTEM + agentBlock,
      model,
      body.hermesProvider
    );
    if (!text) {
      return Response.json({ error: error || "no article" }, { status: 500 });
    }
    // Extract title from the markdown for slug
    const titleMatch = text.match(/^#\s+(.+?)$/m);
    const rawTitle = titleMatch
      ? titleMatch[1].replace(/<\/?em>/g, "").trim()
      : keyword;
    const articleSlug = slug(rawTitle);
    const rel = path.join("SEO", "Drafts", `${articleSlug}.md`);
    const md =
      `---\nkeyword: ${JSON.stringify(keyword)}\ntitle: ${JSON.stringify(rawTitle)}\nslug: ${articleSlug}\ndate: ${todayStamp()}\ntags: [agentic-os, seo, draft]\n---\n\n` +
      text.trim() +
      "\n";
    await writeNote(rel, md);
    return Response.json({
      ok: true,
      slug: articleSlug,
      title: rawTitle,
      article: text.trim(),
      file: rel,
    });
  }

  if (body.mode === "meta") {
    const article = (body.article ?? "").trim();
    if (!article) {
      return Response.json({ error: "article required" }, { status: 400 });
    }
    const prompt =
      `Article:\n\n${article}` +
      (body.productNames
        ? `\n\nProducts that exist in our store (use only these in the \`products\` array): ${body.productNames}`
        : "");
    const { text, error } = await runBrain(
      provider,
      prompt,
      META_SYSTEM + agentBlock,
      model,
      body.hermesProvider
    );
    if (!text) {
      return Response.json({ error: error || "no meta" }, { status: 500 });
    }
    return Response.json({ ok: true, meta: text.trim() });
  }

  return Response.json({ error: "bad mode" }, { status: 400 });
}

export async function GET() {
  const files = (await listNotes("SEO/Drafts")).filter((f) => f.endsWith(".md"));
  const drafts = await Promise.all(
    files.map(async (f) => {
      const content = await readNote(f);
      const frontmatter = content?.match(/^---\n([\s\S]+?)\n---/);
      const fm = frontmatter ? frontmatter[1] : "";
      const keyword = fm.match(/keyword:\s*(.+)/)?.[1]?.replace(/^"|"$/g, "");
      const title = fm.match(/title:\s*(.+)/)?.[1]?.replace(/^"|"$/g, "");
      const slug = fm.match(/slug:\s*(.+)/)?.[1];
      const date = fm.match(/date:\s*(.+)/)?.[1];
      return { file: f, keyword, title, slug, date };
    })
  );
  drafts.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return Response.json({ drafts });
}
