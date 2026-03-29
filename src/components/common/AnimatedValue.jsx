// ─── ANIMATED COUNTER ─────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { fmt } from '../../utils/formatting';

export function AnimatedValue({ value, prefix = "", suffix = "" }) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const numericTarget = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
    if (isNaN(numericTarget)) {
      setDisplay(value);
      return;
    }

    let start = 0;
    const duration = 800;
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * numericTarget);

      if (typeof value === "string" && value.includes("$")) {
        setDisplay(fmt(current));
      } else {
        setDisplay(prefix + current + suffix);
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, prefix, suffix]);

  return <>{display}</>;
}
