import { getSecret } from "./secrets";

// ── OpenAI image generation (gpt-image-1 / DALL-E 3 family) ────────

export interface GenerateImageOptions {
  prompt: string;
  model?: string;       // gpt-image-1 | gpt-image-1-mini | gpt-image-2 | dall-e-3
  size?: string;        // 1024x1024 | 1536x1024 | 1024x1536 | auto
  quality?: string;     // low | medium | high | auto
  n?: number;
}

export interface GeneratedImage {
  b64: string;
  revisedPrompt?: string;
}

export async function generateImage(
  opts: GenerateImageOptions
): Promise<{ images: GeneratedImage[]; error?: string }> {
  const key = await getSecret("OPENAI_API_KEY");
  if (!key) {
    return { images: [], error: "OPENAI_API_KEY not configured" };
  }

  const body = {
    model: opts.model || "gpt-image-1",
    prompt: opts.prompt,
    size: opts.size || "1024x1024",
    quality: opts.quality || "high",
    n: opts.n || 1,
  };

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        images: [],
        error: `OpenAI ${res.status}: ${text.slice(0, 300)}`,
      };
    }
    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string; revised_prompt?: string }>;
    };
    const images = (data.data ?? [])
      .filter((d) => d.b64_json)
      .map((d) => ({ b64: d.b64_json!, revisedPrompt: d.revised_prompt }));
    return { images };
  } catch (err) {
    return {
      images: [],
      error: err instanceof Error ? err.message : "network error",
    };
  }
}
