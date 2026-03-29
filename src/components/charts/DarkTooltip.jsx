// ─── RECHARTS CUSTOM TOOLTIPS ────────────────────────────────────────────────
import { fmt } from '../../utils/formatting';

export function DarkTooltip({ active, payload, label, valuePrefix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1E293B", border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 8, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      fontFamily: "'DM Mono', monospace",
    }}>
      {label && <p style={{ margin: "0 0 6px", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: 0, fontSize: 12, color: entry.color || "#F1F5F9", fontWeight: 600 }}>
          {entry.name}: {valuePrefix}{fmt(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  return (
    <div style={{
      background: "#1E293B", border: `1px solid ${data.payload?.fill || "rgba(255,255,255,0.15)"}40`,
      borderRadius: 8, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      fontFamily: "'DM Mono', monospace",
    }}>
      <p style={{ margin: "0 0 4px", fontSize: 11, color: data.payload?.fill || "#F1F5F9", fontWeight: 600 }}>{data.name}</p>
      <p style={{ margin: 0, fontSize: 13, color: "#F1F5F9", fontWeight: 700 }}>{fmt(data.value)}</p>
    </div>
  );
}
