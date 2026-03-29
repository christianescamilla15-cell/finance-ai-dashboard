// ─── ANOMALY ROW ─────────────────────────────────────────────────────────────
import { memo } from "react";
import { fmt } from '../../utils/formatting';

export const AnomalyRow = memo(function AnomalyRow({ tx, onAnalyze, isHighlighted, rowRef, t: rowT }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onAnalyze(tx);
    }
  };

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      aria-label={`Anomalia: ${tx.description}, ${fmt(tx.amount)}, riesgo ${Math.round(tx.anomalyScore * 100)}%`}
      style={{
        display: "grid", gridTemplateColumns: "1fr auto auto auto",
        alignItems: "center", gap: 12,
        padding: "10px 14px",
        background: isHighlighted ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.04)",
        border: `1px solid ${isHighlighted ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.12)"}`,
        borderRadius: 8, marginBottom: 6,
        animation: "fadeUp 0.3s ease",
        transition: "all 0.3s ease",
        cursor: "pointer",
      }}
      onClick={() => onAnalyze(tx)}
      onKeyDown={handleKeyDown}
    >
      <div>
        <p style={{ margin: 0, fontSize: 12, color: "#F1F5F9", fontWeight: 500 }}>{tx.description}</p>
        <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>
          {tx.date} · {tx.category} · {tx._deviation ? `${tx._deviation}σ ${rowT?.desviacion || 'desviacion'}` : ""}
        </p>
      </div>
      <div style={{
        fontSize: 10, fontFamily: "'DM Mono', monospace",
        color: "#EF4444", fontWeight: 700,
        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
        borderRadius: 4, padding: "2px 7px",
      }}>
        {Math.round(tx.anomalyScore * 100)}% {rowT?.riesgo || 'riesgo'}
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#F87171", fontFamily: "'DM Mono', monospace" }}>
        {fmt(tx.amount)}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onAnalyze(tx); }}
        aria-label={`Analizar con IA: ${tx.description}`}
        style={{
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 6, padding: "5px 10px", cursor: "pointer",
          fontSize: 11, color: "#FCA5A5", fontFamily: "sans-serif",
          transition: "all 0.15s",
        }}
      >
        {rowT?.analizarIA || 'Analizar IA'}
      </button>
    </div>
  );
});
