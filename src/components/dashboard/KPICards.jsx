// ─── KPI CARDS ──────────────────────────────────────────────────────────────
import { memo } from "react";
import { motion } from "framer-motion";
import { fmt } from '../../utils/formatting';
import { AnimatedValue } from '../common/AnimatedValue';
import { Sparkline } from '../charts/Sparkline';
import { APPLE_EASE } from '../../constants/animation';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: APPLE_EASE },
  }),
};

export const KPICards = memo(function KPICards({ metrics, anomalies, transactions, monthlyValues, t, colors }) {
  const accent = "#10B981";

  const kpis = [
    { label: t.gastoTotal, value: fmt(metrics.total), rawValue: metrics.total, sub: `${Object.keys(metrics.monthly).length} ${t.mesesDeDatos}`, color: accent, trend: monthlyValues, isCurrency: true },
    { label: t.anomaliasDetectadas, value: String(anomalies.length), rawValue: anomalies.length, sub: `${transactions.length > 0 ? Math.round((anomalies.length / transactions.length) * 100) : 0}% ${t.delTotal}`, color: "#EF4444", alert: true },
    { label: t.mayorCategoria, value: Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A", sub: fmt(Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1])[0]?.[1] || 0), color: "#F59E0B", isText: true },
    { label: t.promedioMensual, value: fmt(metrics.total / Math.max(Object.keys(metrics.monthly).length, 1)), rawValue: Math.round(metrics.total / Math.max(Object.keys(metrics.monthly).length, 1)), sub: `${Object.keys(metrics.monthly).length} ${t.meses}`, color: "#8B5CF6", trend: monthlyValues, isCurrency: true },
  ];

  const cardBg = colors ? colors.cardBg : "rgba(255,255,255,0.03)";
  const cardBorder = colors ? colors.cardBorder : "rgba(255,255,255,0.06)";
  const labelColor = colors ? colors.subtextFaint : "rgba(255,255,255,0.35)";
  const subColor = colors ? colors.subtextColor : "rgba(255,255,255,0.3)";

  return (
    <div data-tour="kpi-cards" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
      {kpis.map((kpi, i) => (
        <motion.div
          key={i}
          custom={i}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -3, boxShadow: `0 8px 30px ${kpi.color}15` }}
          style={{
            background: cardBg,
            border: `1px solid ${kpi.alert ? "rgba(239,68,68,0.2)" : cardBorder}`,
            borderRadius: 16, padding: "16px",
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            transition: "border-color 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 10, color: labelColor, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
            {kpi.label}
          </p>
          <p style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: kpi.color, fontFamily: "'DM Mono', monospace" }}>
            {kpi.alert ? (
              <span style={{ animation: anomalies.length > 0 ? "pulse 2s infinite" : "none" }}>
                <AnimatedValue value={kpi.rawValue} />
              </span>
            ) : kpi.isText ? kpi.value : (
              <AnimatedValue value={kpi.rawValue || kpi.value} />
            )}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: subColor }}>{kpi.sub}</p>
          {kpi.trend && kpi.trend.length > 1 && <div style={{ marginTop: 8 }}><Sparkline values={kpi.trend} color={kpi.color} /></div>}
        </motion.div>
      ))}
    </div>
  );
});
