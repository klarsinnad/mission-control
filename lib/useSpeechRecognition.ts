"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in the default DOM lib).
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

function getSR(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface Options {
  /** BCP-47 language tag, e.g. "sv-SE" or "en-US". */
  lang?: string;
  /** Called once per finalized speech segment. */
  onResult?: (finalText: string) => void;
  /** Called with the live (not-yet-final) transcript. */
  onInterim?: (text: string) => void;
}

/**
 * Browser-native speech-to-text. No API keys — uses the Web Speech API.
 * Returns null `supported` on browsers without it (Firefox, etc.).
 */
export function useSpeechRecognition({
  lang = "sv-SE",
  onResult,
  onInterim,
}: Options = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Keep callbacks fresh without re-binding the recognizer.
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  onResultRef.current = onResult;
  onInterimRef.current = onInterim;

  useEffect(() => {
    setSupported(!!getSR());
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const SR = getSR();
    if (!SR) return;
    stop();

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0].transcript;
        if (res.isFinal) onResultRef.current?.(txt.trim());
        else interim += txt;
      }
      if (interim) onInterimRef.current?.(interim);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [lang, stop]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  // Clean up on unmount.
  useEffect(
    () => () => {
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
    },
    []
  );

  return { supported, listening, start, stop, toggle };
}
