"use client";

import { useEffect, useState } from "react";
import { useSpring, useMotionValueEvent } from "framer-motion";

interface Props {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({ value, format, className }: Props) {
  const spring = useSpring(value, { stiffness: 80, damping: 22, mass: 0.7 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useMotionValueEvent(spring, "change", (v) => setDisplay(v));

  const text = format ? format(display) : Math.round(display).toLocaleString();
  return <span className={className}>{text}</span>;
}
