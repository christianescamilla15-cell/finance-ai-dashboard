// ─── OVERVIEW TAB ────────────────────────────────────────────────────────────
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { fmt } from '../../utils/formatting';
import { getCatColor } from '../../constants/colors';
import { DarkTooltip, PieTooltip } from '../charts/DarkTooltip';
import { MiniBarChart } from '../charts/MiniBarChart';
import { APPLE_EASE } from '../../constants/animation';

export function OverviewTab({ metrics, anomalies, t, onViewAnomalies, colors }) {
  const accent = "#10B981";

  const cardBg = colors ? colors.cardBg : "rgba(255,255,255,0.03)";
  const cardBorder = colors ? colors.cardBorder : "rgba(255,255,255,0.06)";
  const headerColor = colors ? colors.headerColor : "rgba(255,255,255,0.5)";
  const subtextColor = colors ? colors.subtextColor : "rgba(255,255,255,0.3)";
  const textColor = colors ? colors.text : "#F1F5F9";
  const isDark = !colors || colors.bg === '#09090B' || colors.bg === '#0A0B0F';

  return (
    <div data-tour="overview-charts">
      {/* Monthly Trend AreaChart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: APPLE_EASE }}
        style={{
          background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20, marginBottom: 16,
          backdropFilter: isDark ? "blur(12px)" : "none",
        }}
      >
        <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: headerColor, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
          {t.tendenciaMensual}
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={Object.entries(metrics.monthly).sort((a, b) => a[0].localeCompare(b[0])).map(([month, total]) => ({ month: month.slice(2), total }))} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
            <XAxis dataKey="month" tick={{ fill: subtextColor, fontSize: 10, fontFamily: "'DM Mono', monospace" }} axisLine={{ stroke: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} tickLine={false} />
            <YAxis tick={{ fill: subtextColor, fontSize: 10, fontFamily: "'DM Mono', monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} width={80} />
            <Tooltip content={<DarkTooltip />} />
            <Area type="monotone" dataKey="total" name={t.gasto} stroke="#10B981" strokeWidth={2} fill="url(#areaGradient)" dot={{ r: 3, fill: "#10B981", stroke: isDark ? "#09090B" : "#F8FAFC", strokeWidth: 2 }} activeDot={{ r: 5, fill: "#10B981", stroke: isDark ? "#09090B" : "#F8FAFC", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        {/* Category PieChart + legend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: APPLE_EASE }}
          style={{
            background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20,
            backdropFilter: isDark ? "blur(12px)" : "none",
          }}
        >
          <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: headerColor, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
            {t.gastoPorCategoria}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: "0 0 200px" }}>
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={Object.entries(metrics.byCategory).map(([name, value]) => ({ name, value }))}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {Object.entries(metrics.byCategory).map(([cat]) => (
                      <Cell key={cat} fill={getCatColor(cat)} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, val], i) => (
                <motion.div
                  key={cat}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.04, duration: 0.35, ease: APPLE_EASE }}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: getCatColor(cat), flexShrink: 0, boxShadow: `0 0 6px ${getCatColor(cat)}40` }} />
                  <span style={{ fontSize: 11, color: headerColor, flex: 1 }}>{cat}</span>
                  <span style={{ fontSize: 11, color: subtextColor, fontFamily: "'DM Mono', monospace" }}>{fmt(val)}</span>
                </motion.div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <MiniBarChart data={metrics.byCategory} />
          </div>
        </motion.div>

        {/* Recent anomalies */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: APPLE_EASE }}
          style={{
            background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20,
            backdropFilter: isDark ? "blur(12px)" : "none",
          }}
        >
          <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: headerColor, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
            {t.ultimasAnomalias}
          </p>
          {anomalies.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <p style={{ fontSize: 24, margin: "0 0 8px" }}>OK</p>
              <p style={{ fontSize: 12, color: subtextColor, margin: 0 }}>{t.noAnomalias}</p>
            </div>
          ) : (
            anomalies.slice(0, 5).map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.05, duration: 0.35, ease: APPLE_EASE }}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9"}` }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: textColor }}>{tx.category}</p>
                  <p style={{ margin: 0, fontSize: 10, color: subtextColor, fontFamily: "'DM Mono', monospace" }}>{tx.date} · {tx._deviation}σ</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#F87171", fontFamily: "'DM Mono', monospace" }}>{fmt(tx.amount)}</span>
              </motion.div>
            ))
          )}
          {anomalies.length > 0 && (
            <button onClick={onViewAnomalies} aria-label="Ver todas las anomalias detectadas" style={{
              width: "100%", marginTop: 12, padding: "8px",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 12, color: "#FCA5A5", fontSize: 12, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}>
              {t.verTodasAnomalias}
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
