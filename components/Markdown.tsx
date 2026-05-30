"use client";

import React from "react";

/** Minimal, safe markdown renderer — no dependencies, no dangerouslySetInnerHTML.
 *  Handles: fenced code, headings, lists, blockquotes, bold, italic, inline code. */
export function Markdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-2.5 text-[15px] leading-relaxed text-white/85">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}

type BlockNode =
  | { type: "code"; lang: string; content: string }
  | { type: "heading"; level: number; content: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; content: string }
  | { type: "p"; content: string };

function parseBlocks(text: string): BlockNode[] {
  const lines = text.split("\n");
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ type: "code", lang, content: buf.join("\n") });
      continue;
    }

    // heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      blocks.push({ type: "heading", level: h[1].length, content: h[2] });
      i++;
      continue;
    }

    // list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", content: buf.join(" ") });
      continue;
    }

    // blank
    if (line.trim() === "") {
      i++;
      continue;
    }

    // paragraph (consume until blank / special)
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", content: buf.join(" ") });
  }

  return blocks;
}

function Block({ block }: { block: BlockNode }) {
  switch (block.type) {
    case "code":
      return (
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3.5 font-mono text-[13px] text-cyan/90">
          <code>{block.content}</code>
        </pre>
      );
    case "heading": {
      const sizes = ["text-lg", "text-base", "text-sm", "text-sm"];
      return (
        <p
          className={`font-semibold text-white ${
            sizes[block.level - 1] ?? "text-sm"
          }`}
        >
          <Inline text={block.content} />
        </p>
      );
    }
    case "list":
      return (
        <ul className="space-y-1">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-violet" />
              <span>
                <Inline text={it} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-violet/50 pl-3 text-white/55 italic">
          <Inline text={block.content} />
        </blockquote>
      );
    default:
      return (
        <p>
          <Inline text={block.content} />
        </p>
      );
  }
}

/** Inline formatting: **bold**, *italic*, `code` */
function Inline({ text }: { text: string }) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {tokens.map((t, i) => {
        if (!t) return null;
        if (t.startsWith("`") && t.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-cyan"
            >
              {t.slice(1, -1)}
            </code>
          );
        }
        if (t.startsWith("**") && t.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-white">
              {t.slice(2, -2)}
            </strong>
          );
        }
        if (t.startsWith("*") && t.endsWith("*")) {
          return (
            <em key={i} className="text-white/70">
              {t.slice(1, -1)}
            </em>
          );
        }
        return <React.Fragment key={i}>{t}</React.Fragment>;
      })}
    </>
  );
}
