// ─── SPARKLINE WITH TOOLTIP ──────────────────────────────────────────────────
import { useState, useRef } from "react";
import { fmt } from '../../utils/formatting';

export function Sparkline({ values, color = "#10B981" }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  const max = Math.max(...values);
  const min = Math.min(...values);
  const h = 36, w = 120;

  const getPoint = (v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: h - ((v - min) / (max - min || 1)) * h,
  });

  const points = values.map((v, i) => {
    const p = getPoint(v, i);
    return `${p.x},${p.y}`;
  }).join(" ");

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x / rect.width) * (values.length - 1));
    if (idx >= 0 && idx < values.length) setHoverIdx(idx);
  };

  const hoverPoint = hoverIdx !== null ? getPoint(values[hoverIdx], hoverIdx) : null;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg
        ref={svgRef}
        width={w}
        height={h}
        style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={`0,${h} ${points} ${w},${h}`} fill={`${color}18`} stroke="none" />
        {hoverPoint && (
          <circle cx={hoverPoint.x} cy={hoverPoint.y} r={3} fill={color} stroke="#080C10" strokeWidth={1.5} />
        )}
      </svg>
      {hoverIdx !== null && hoverPoint && (
        <div style={{
          position: "absolute",
          left: Math.min(hoverPoint.x, w - 50),
          top: -24,
          background: "#1E293B",
          border: `1px solid ${color}40`,
          borderRadius: 4,
          padding: "2px 6px",
          fontSize: 9,
          fontFamily: "'DM Mono', monospace",
          color: color,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          zIndex: 10,
        }}>
          {fmt(values[hoverIdx])}
        </div>
      )}
    </div>
  );
}
