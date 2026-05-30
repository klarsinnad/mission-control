"use client";

import { Mic } from "lucide-react";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

interface Props {
  /** Receives each finalized speech segment. */
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  lang?: string;
  title?: string;
  className?: string;
}

/**
 * Tap-to-dictate mic. Pulses rose while listening. Renders nothing on
 * browsers without the Web Speech API.
 */
export function MicButton({
  onResult,
  onInterim,
  lang,
  title = "Dictate",
  className = "",
}: Props) {
  const { supported, listening, toggle } = useSpeechRecognition({
    lang,
    onResult,
    onInterim,
  });

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Stop dictation" : title}
      aria-pressed={listening}
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${className}`}
      style={
        listening
          ? {
              background: "rgba(251,113,133,0.16)",
              border: "1px solid rgba(251,113,133,0.45)",
            }
          : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }
      }
    >
      {listening && (
        <span
          className="pulse-ring"
          style={{ background: "#fb7185", opacity: 0.3 }}
        />
      )}
      <Mic
        className="relative z-10 h-4 w-4"
        style={{ color: listening ? "#fb7185" : "rgba(255,255,255,0.55)" }}
      />
    </button>
  );
}
