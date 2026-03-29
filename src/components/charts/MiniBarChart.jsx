// ─── MINI BAR CHART ───────────────────────────────────────────────────────────
import { fmt } from '../../utils/formatting';
import { getCatColor } from '../../constants/colors';

export function MiniBarChart({ data }) {
  const max = Math.max(...Object.values(data));
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 48 }}>
      {Object.entries(data).map(([cat, val]) => (
        <div key={cat} title={`${cat}: ${fmt(val)}`} style={{
          flex: 1, borderRadius: "3px 3px 0 0",
          background: getCatColor(cat),
          height: `${(val / max) * 100}%`,
          minHeight: 3, transition: "height 0.5s ease",
          cursor: "pointer",
        }} />
      ))}
    </div>
  );
}
