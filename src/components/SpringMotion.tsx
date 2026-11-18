import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

export const SPRING_TACTILE = {
  type: "spring" as const,
  stiffness: 420,
  damping: 30,
  mass: 0.75,
};

/**
 * Spring-interpolated numeric counter for KPI tiles.
 * Respects prefers-reduced-motion and renders tabular numerals without jitter.
 */
export function SpringNumber({
  value,
  formatter = (n) => new Intl.NumberFormat("en-US").format(Math.round(n)),
  durationMs = 450,
}: {
  value: number;
  formatter?: (n: number) => string;
  durationMs?: number;
}) {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const currentRef = useRef(value);

  useEffect(() => {
    if (prefersReduced) {
      currentRef.current = value;
      setDisplay(value);
      return;
    }

    const startVal = currentRef.current;
    const diff = value - startVal;
    if (Math.abs(diff) < 0.01) {
      currentRef.current = value;
      setDisplay(value);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // Smooth spring-like overshoot-damped settle curve
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startVal + diff * eased;
      currentRef.current = next;
      setDisplay(next);

      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        currentRef.current = value;
        setDisplay(value);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs, prefersReduced]);

  return <span className="tabular-nums">{formatter(display)}</span>;
}

/**
 * Lightweight compositor-only page entrance transition.
 */
export function SpringPage({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_TACTILE}
      className={className}
    >
      {children}
    </motion.div>
  );
}
