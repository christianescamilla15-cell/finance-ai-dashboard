// ─── FORECAST / PROJECTION TAB ───────────────────────────────────────────────
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { fmt } from '../../utils/formatting';
import { getCatColor } from '../../constants/colors';
import { DarkTooltip } from '../charts/DarkTooltip';
import { Skeleton } from '../common/Skeleton';
import { APPLE_EASE } from '../../constants/animation';

export function ForecastPanel({ forecastData, loadingForecast, forecastError, generateForecast, metrics, dataSource, lang, t, colors }) {
  const accent = "#10B981";
  const isDark = !colors || colors.bg === '#09090B' || colors.bg === '#0A0B0F';
  const cardBg = colors ? colors.cardBg : "rgba(255,255,255,0.03)";
  const cardBorder = colors ? colors.cardBorder : "rgba(255,255,255,0.06)";
  const headerColor = colors ? colors.headerColor : "rgba(255,255,255,0.5)";
  const subtextColor = colors ? colors.subtextColor : "rgba(255,255,255,0.3)";
  const subtextFaint = colors ? colors.subtextFaint : "rgba(255,255,255,0.35)";
  const textColor = colors ? colors.text : "#D1D5DB";
  const dotStroke = isDark ? "#09090B" : "#F8FAFC";

  return (
    <div data-tour="projection-tab">
      {!forecastData && !loadingForecast && !forecastError && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: 18, margin: "0 0 12px", color: subtextColor }}>{t.proyeccionFinanciera}</p>
          <p style={{ fontSize: 15, color: headerColor, marginBottom: 20 }}>
            {t.generaProyeccion} {dataSource === "imported" ? t.importados : t.ultimos90Dias}
          </p>
          <button onClick={generateForecast} disabled={loadingForecast} aria-label="Generar proyeccion financiera" style={{
            background: `linear-gradient(135deg, ${accent}, #059669)`,
            border: "none", borderRadius: 10, padding: "13px 32px",
            fontSize: 14, fontWeight: 700, color: "#fff",
            cursor: loadingForecast ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif",
            boxShadow: `0 0 24px ${accent}40`,
            opacity: loadingForecast ? 0.6 : 1,
          }}>
            {t.generarProyeccion}
          </button>
        </div>
      )}

      {loadingForecast && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${accent}30`, borderTop: `3px solid ${accent}`, animation: "spinAnim 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: isDark ? "rgba(255,255,255,0.4)" : "#64748B", fontSize: 13, margin: "0 0 24px" }}>{t.calculandoRegresion}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 10, padding: 16 }}>
                <Skeleton height={10} width="60%" style={{ marginBottom: 10 }} />
                <Skeleton height={22} width="80%" />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[1, 2].map(i => (
              <div key={i} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 10, padding: 16 }}>
                <Skeleton height={10} width="40%" style={{ marginBottom: 12 }} />
                <Skeleton height={12} width="90%" style={{ marginBottom: 6 }} />
                <Skeleton height={12} width="75%" style={{ marginBottom: 6 }} />
                <Skeleton height={12} width="85%" />
              </div>
            ))}
          </div>
        </div>
      )}

      {forecastError && !loadingForecast && (
        <div style={{
          textAlign: "center", padding: "48px 20px",
          background: "rgba(239,68,68,0.05)",
          border: "1px solid rgba(239,68,68,0.15)",
          borderRadius: 12,
        }}>
          <p style={{ fontSize: 14, color: "#FCA5A5", margin: "0 0 16px" }}>{forecastError}</p>
          <button onClick={generateForecast} aria-label="Reintentar generacion de proyeccion" style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 8, padding: "10px 24px", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "#FCA5A5",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {t.reintentar}
          </button>
        </div>
      )}

      {forecastData && !forecastData.error && (
        <div style={{ animation: "fadeUp 0.4s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: t.proyeccionProximoMes, value: fmt(forecastData.proyeccion_mes), color: accent },
              { label: t.tendencia, value: forecastData.tendencia?.toUpperCase(), color: forecastData.tendencia === "alcista" ? "#EF4444" : forecastData.tendencia === "bajista" ? accent : "#F59E0B" },
              { label: t.variacionEsperada, value: `${forecastData.variacion_esperada > 0 ? "+" : ""}${forecastData.variacion_esperada}%`, color: forecastData.variacion_esperada > 0 ? "#EF4444" : accent },
            ].map((k, i) => (
              <div key={i} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 10, padding: 16 }}>
                <p style={{ margin: "0 0 6px", fontSize: 10, color: subtextFaint, fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>{k.label}</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: k.color, fontFamily: "'DM Mono', monospace" }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Category trends */}
          {forecastData.catTrends && Object.keys(forecastData.catTrends).length > 0 && (
            <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: headerColor, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{t.tendenciasPorCategoria}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(forecastData.catTrends).sort((a, b) => b[1] - a[1]).map(([cat, change]) => (
                  <div key={cat} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "4px 10px", borderRadius: 6,
                    background: change > 15 ? "rgba(239,68,68,0.08)" : change < -15 ? "rgba(16,185,129,0.08)" : (isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                    border: `1px solid ${change > 15 ? "rgba(239,68,68,0.15)" : change < -15 ? "rgba(16,185,129,0.15)" : (isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0")}`,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: getCatColor(cat) }} />
                    <span style={{ fontSize: 11, color: headerColor }}>{cat}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                      color: change > 15 ? "#F87171" : change < -15 ? accent : (isDark ? "rgba(255,255,255,0.4)" : "#64748B"),
                    }}>
                      {change > 0 ? "+" : ""}{change}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regression info */}
          {forecastData.regression && (
            <div style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#8B5CF6", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{t.modeloRegresion}</p>
              <div style={{ display: "flex", gap: 20 }}>
                <span style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.4)" : "#64748B", fontFamily: "'DM Mono', monospace" }}>
                  {t.pendiente}: {fmt(Math.round(forecastData.regression.slope))}/{lang === 'es' ? 'mes' : 'mo'}
                </span>
                <span style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.4)" : "#64748B", fontFamily: "'DM Mono', monospace" }}>
                  R² = {Math.round(forecastData.regression.r2 * 100)}%
                </span>
                <span style={{ fontSize: 11, color: forecastData.regression.r2 > 0.7 ? accent : forecastData.regression.r2 > 0.4 ? "#F59E0B" : "#EF4444", fontFamily: "'DM Mono', monospace" }}>
                  {t.ajuste}: {forecastData.regression.r2 > 0.7 ? t.bueno : forecastData.regression.r2 > 0.4 ? t.moderado : t.bajo}
                </span>
              </div>
            </div>
          )}

          {/* Forecast LineChart */}
          {forecastData.regression && (() => {
            const monthlyEntries = Object.entries(metrics.monthly).sort((a, b) => a[0].localeCompare(b[0]));
            const avg = monthlyEntries.length > 0 ? monthlyEntries.reduce((s, e) => s + e[1], 0) / monthlyEntries.length : 0;
            const chartData = monthlyEntries.map(([month, total], i) => ({
              month: month.slice(2),
              historico: total,
              proyeccion: null,
            }));
            if (chartData.length > 0) {
              chartData[chartData.length - 1].proyeccion = chartData[chartData.length - 1].historico;
            }
            const lastMonth = monthlyEntries[monthlyEntries.length - 1]?.[0];
            if (lastMonth) {
              const [y, m] = lastMonth.split("-").map(Number);
              const nextDate = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
              chartData.push({
                month: nextDate.slice(2),
                historico: null,
                proyeccion: forecastData.proyeccion_mes,
              });
            }
            return (
              <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 10, padding: 20, marginBottom: 12 }}>
                <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: headerColor, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
                  {t.historicoVsProyeccion}
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
                    <XAxis dataKey="month" tick={{ fill: subtextColor, fontSize: 10, fontFamily: "'DM Mono', monospace" }} axisLine={{ stroke: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} tickLine={false} />
                    <YAxis tick={{ fill: subtextColor, fontSize: 10, fontFamily: "'DM Mono', monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} width={80} />
                    <Tooltip content={<DarkTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: isDark ? "rgba(255,255,255,0.4)" : "#64748B" }} />
                    <ReferenceLine y={Math.round(avg)} stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"} strokeDasharray="6 4" label={{ value: `${t.promedio}: ${fmt(Math.round(avg))}`, position: "insideTopRight", fill: isDark ? "rgba(255,255,255,0.25)" : "#94A3B8", fontSize: 10, fontFamily: "'DM Mono', monospace" }} />
                    <Line type="monotone" dataKey="historico" name={t.historico} stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: "#10B981", stroke: dotStroke, strokeWidth: 2 }} connectNulls={false} />
                    <Line type="monotone" dataKey="proyeccion" name={t.proyeccionLabel} stroke="#8B5CF6" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 4, fill: "#8B5CF6", stroke: dotStroke, strokeWidth: 2 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#EF4444", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{t.alertas}</p>
              {forecastData.alertas?.map((a, i) => (
                <p key={i} style={{ margin: "0 0 6px", fontSize: 12, color: "#FCA5A5", paddingLeft: 12, borderLeft: "2px solid rgba(239,68,68,0.4)" }}>- {a}</p>
              ))}
            </div>
            <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{t.recomendaciones}</p>
              {forecastData.recomendaciones?.map((r, i) => (
                <p key={i} style={{ margin: "0 0 6px", fontSize: 12, color: "#D1FAE5", paddingLeft: 12, borderLeft: "2px solid rgba(16,185,129,0.4)" }}>- {r}</p>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12, padding: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 10 }}>
            <p style={{ margin: "0 0 6px", fontSize: 10, color: subtextColor, fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.resumenEjecutivo}</p>
            <p style={{ margin: 0, fontSize: 13, color: textColor, lineHeight: 1.7 }}>{forecastData.resumen}</p>
          </div>
          <button onClick={generateForecast} disabled={loadingForecast} aria-label="Regenerar proyeccion financiera" style={{
            marginTop: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 8, padding: "9px 18px", fontSize: 12, color: accent,
            cursor: loadingForecast ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif",
            opacity: loadingForecast ? 0.6 : 1,
          }}>
            {t.regenerarProyeccion}
          </button>
        </div>
      )}

      {forecastData?.error && (
        <div style={{
          textAlign: "center", padding: "48px 20px",
          background: "rgba(239,68,68,0.05)",
          border: "1px solid rgba(239,68,68,0.15)",
          borderRadius: 12,
        }}>
          <p style={{ fontSize: 14, color: "#FCA5A5", margin: "0 0 16px" }}>
            {forecastData.error}
          </p>
          <button onClick={generateForecast} aria-label="Reintentar proyeccion" style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 8, padding: "10px 24px", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "#FCA5A5",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {t.reintentar}
          </button>
        </div>
      )}
    </div>
  );
}
