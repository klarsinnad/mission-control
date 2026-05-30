import { spawn } from "node:child_process";
import os from "node:os";
import { generateImage } from "@/lib/openai-image";
import { saveStudioImage } from "@/lib/studio";
import { buildAgentSystemPrompt } from "@/lib/q-agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CLAUDE_BIN = process.env.CLAUDE_CLI_PATH || "claude";

const REFINE_SYSTEM_SUFFIX = `

---

# Special directive: prompt director mode

The operator wants you to refine a brief image idea into a richer image generation prompt.

Output exactly one paragraph — no preamble, no headings, no code blocks. Include subject, composition, lighting, style, mood, and any technical detail (camera, lens, medium) that fits. Keep it under 150 words. Output in English (OpenAI's image model performs best in English) even if the input is Swedish.`;

async function refinePrompt(
  agentId: string,
  brief: string
): Promise<{ refined: string | null; agentName: string | null }> {
  const agent = await buildAgentSystemPrompt(agentId);
  if (!agent) return { refined: null, agentName: null };

  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    let child;
    try {
      child = spawn(
        CLAUDE_BIN,
        [
          "-p",
          `Brief: ${brief}`,
          "--output-format",
          "json",
          "--model",
          "claude-haiku-4-5",
          "--system-prompt",
          agent.prompt + REFINE_SYSTEM_SUFFIX,
        ],
        { cwd: os.tmpdir(), env }
      );
    } catch {
      resolve({ refined: null, agentName: agent.name });
      return;
    }
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.on("close", () => {
      try {
        const parsed = JSON.parse(out);
        const text =
          typeof parsed.result === "string" ? parsed.result.trim() : null;
        resolve({ refined: text || null, agentName: agent.name });
      } catch {
        resolve({ refined: null, agentName: agent.name });
      }
    });
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    prompt?: string;
    model?: string;
    size?: string;
    quality?: string;
    agentId?: string;
  };

  const userPrompt = (body.prompt ?? "").trim();
  if (!userPrompt) {
    return Response.json({ error: "prompt required" }, { status: 400 });
  }
  const model = body.model || "gpt-image-1";
  const size = body.size || "1024x1024";
  const quality = body.quality || "high";

  // Optional refinement via a Q-agent (Visualizer is a natural director).
  let finalPrompt = userPrompt;
  let refinedPrompt: string | undefined;
  let refinedBy: string | undefined;
  if (body.agentId) {
    const { refined, agentName } = await refinePrompt(body.agentId, userPrompt);
    if (refined && agentName) {
      finalPrompt = refined;
      refinedPrompt = refined;
      refinedBy = agentName;
    }
  }

  const { images, error } = await generateImage({
    prompt: finalPrompt,
    model,
    size,
    quality,
  });
  if (error || !images.length) {
    return Response.json({ error: error || "no image returned" }, { status: 500 });
  }

  const buf = Buffer.from(images[0].b64, "base64");
  const saved = await saveStudioImage({
    prompt: userPrompt,
    refinedPrompt,
    refinedBy,
    agentId: body.agentId,
    model,
    size,
    quality,
    pngBuffer: buf,
  });

  return Response.json({ image: saved });
}
