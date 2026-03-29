// ─── ANOMALY TABLE / TAB ─────────────────────────────────────────────────────
import { useRef } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AnomalyRow } from './AnomalyRow';
import { Skeleton } from '../common/Skeleton';
import { APPLE_EASE } from '../../constants/animation';

export function AnomalyTable({ anomalies, selectedTx, setSelectedTx, analyzeAnomaly, loadingAI, aiError, aiAnalysis, t }) {
  const analysisRef = useRef(null);
  const anomalyRowRefs = useRef({});
  const accent = "#10B981";

  return (
    <div data-tour="anomalies-tab">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 14, color: "#FAFAFA", fontWeight: 600 }}>
          {anomalies.length > 0
            ? `${anomalies.length} ${t.anomaliasDetectadasMsg}`
            : t.noAnomaliasEstadisticas}
        </p>
        {anomalies.length > 0 && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>
            {t.ordenadasPorScore}
          </span>
        )}
      </div>

      {/* Risk Distribution Chart */}
      {anomalies.length > 0 && (() => {
        const alto = anomalies.filter(t => Math.round(t.anomalyScore * 100) >= 70).length;
        const medio = anomalies.filter(t => { const s = Math.round(t.anomalyScore * 100); return s >= 40 && s < 70; }).length;
        const bajo = anomalies.filter(t => Math.round(t.anomalyScore * 100) < 40).length;
        const riskData = [
          { name: "Alto (>70%)", count: alto, fill: "#EF4444" },
          { name: "Medio (40-70%)", count: medio, fill: "#F59E0B" },
          { name: "Bajo (<40%)", count: bajo, fill: "#10B981" },
        ];
        return (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: APPLE_EASE }}
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 16, backdropFilter: "blur(12px)" }}
          >
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
              {t.distribucionRiesgo}
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={riskData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "'DM Mono', monospace" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "'DM Mono', monospace" }} axisLine={false} tickLine={false} width={110} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div style={{ background: "rgba(15,15,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "8px 12px", fontFamily: "'DM Mono', monospace", backdropFilter: "blur(20px)" }}>
                      <p style={{ margin: 0, fontSize: 12, color: payload[0].payload.fill, fontWeight: 600 }}>{payload[0].payload.name}: {payload[0].value} anomalias</p>
                    </div>
                  );
                }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                  {riskData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        );
      })()}

      {anomalies.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: APPLE_EASE }}
          style={{
            textAlign: "center", padding: "48px 20px",
            background: "rgba(16,185,129,0.05)",
            border: "1px solid rgba(16,185,129,0.15)",
            borderRadius: 16, backdropFilter: "blur(12px)",
          }}
        >
          <p style={{ fontSize: 36, margin: "0 0 12px" }}>OK</p>
          <p style={{ fontSize: 15, color: accent, fontWeight: 600, margin: "0 0 6px" }}>
            {t.noAnomaliasDetectadas}
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
            {t.todasDentroRango}
          </p>
        </motion.div>
      ) : (
        anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore).map((tx, i) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.4, ease: APPLE_EASE }}
          >
            <AnomalyRow
              tx={tx}
              onAnalyze={analyzeAnomaly}
              isHighlighted={selectedTx?.id === tx.id}
              rowRef={el => { anomalyRowRefs.current[tx.id] = el; }}
              t={t}
            />
          </motion.div>
        ))
      )}

      {/* Panel analisis IA */}
      {selectedTx && (
        <motion.div
          ref={analysisRef}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: APPLE_EASE }}
          style={{
            marginTop: 20, padding: 20,
            background: "rgba(16,185,129,0.05)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 16, backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
              {t.analisisEstadistico} — {selectedTx.description}
            </p>
            <button onClick={() => setSelectedTx(null)} aria-label="Cerrar panel de analisis" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16 }}>X</button>
          </div>
          {loadingAI ? (
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${accent}40`, borderTop: `2px solid ${accent}`, animation: "spinAnim 1s linear infinite" }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{t.calculandoEstadisticas}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Skeleton height={14} width="90%" />
                <Skeleton height={14} width="75%" />
                <Skeleton height={14} width="60%" />
                <Skeleton height={14} width="80%" style={{ marginTop: 8 }} />
                <Skeleton height={14} width="70%" />
              </div>
            </div>
          ) : aiError ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <p style={{ color: "#FCA5A5", fontSize: 13, margin: "0 0 10px" }}>{aiError}</p>
              <button onClick={() => analyzeAnomaly(selectedTx)} aria-label="Reintentar analisis de anomalia" style={{
                background: "rgba(16,185,129,0.12)", border: `1px solid ${accent}40`,
                borderRadius: 8, padding: "7px 18px", cursor: "pointer",
                fontSize: 12, color: accent, fontFamily: "'DM Sans', sans-serif",
              }}>
                {t.reintentarAnalisis}
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "#D1FAE5", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{aiAnalysis}</p>
          )}
        </motion.div>
      )}
    </div>
  );
}
