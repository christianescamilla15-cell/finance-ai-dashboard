import { useState, useEffect } from "react";

// ─── DATA MOCK ────────────────────────────────────────────────────────────────
const generateTransactions = () => {
  const categories = ["Marketing", "Nómina", "Software", "Infraestructura", "Logística", "Ventas", "Operaciones"];
  const transactions = [];
  const now = new Date();

  for (let i = 89; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const count = Math.floor(Math.random() * 4) + 1;
    for (let j = 0; j < count; j++) {
      const cat = categories[Math.floor(Math.random() * categories.length)];
      const base = { Marketing: 8000, Nómina: 45000, Software: 3500, Infraestructura: 12000, Logística: 6000, Ventas: 15000, Operaciones: 9000 };
      const variance = 0.25;
      let amount = base[cat] * (1 + (Math.random() - 0.5) * variance);
      // Inject anomalies
      const isAnomaly = Math.random() < 0.06;
      if (isAnomaly) amount *= (Math.random() > 0.5 ? 3.2 : 0.15);
      transactions.push({
        id: `TX-${Date.now()}-${i}-${j}`,
        date: date.toISOString().split("T")[0],
        category: cat,
        amount: Math.round(amount),
        description: `${cat} — ${["Factura", "Pago", "Transferencia", "Cargo"][Math.floor(Math.random() * 4)]} #${Math.floor(Math.random() * 9000) + 1000}`,
        isAnomaly,
        anomalyScore: isAnomaly ? Math.random() * 0.4 + 0.6 : Math.random() * 0.3,
      });
    }
  }
  return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
};

const TRANSACTIONS = generateTransactions();

// ─── MÉTRICAS ─────────────────────────────────────────────────────────────────
const computeMetrics = (txs) => {
  const total = txs.reduce((s, t) => s + t.amount, 0);
  const anomalies = txs.filter(t => t.isAnomaly);
  const byCategory = {};
  txs.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = 0;
    byCategory[t.category] += t.amount;
  });
  const monthly = {};
  txs.forEach(t => {
    const m = t.date.slice(0, 7);
    if (!monthly[m]) monthly[m] = 0;
    monthly[m] += t.amount;
  });
  return { total, anomalies, byCategory, monthly };
};

const METRICS = computeMetrics(TRANSACTIONS);

// ─── COLORES ──────────────────────────────────────────────────────────────────
const CAT_COLORS = {
  Marketing: "#3B82F6", Nómina: "#10B981", Software: "#8B5CF6",
  Infraestructura: "#F59E0B", Logística: "#EF4444", Ventas: "#06B6D4", Operaciones: "#EC4899",
};

const fmt = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

// ─── MINI BAR CHART ───────────────────────────────────────────────────────────
function MiniBarChart({ data }) {
  const max = Math.max(...Object.values(data));
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 48 }}>
      {Object.entries(data).map(([cat, val]) => (
        <div key={cat} title={`${cat}: ${fmt(val)}`} style={{
          flex: 1, borderRadius: "3px 3px 0 0",
          background: CAT_COLORS[cat] || "#6B7280",
          height: `${(val / max) * 100}%`,
          minHeight: 3, transition: "height 0.5s ease",
          cursor: "pointer",
        }} />
      ))}
    </div>
  );
}

// ─── SPARKLINE ────────────────────────────────────────────────────────────────
function Sparkline({ values, color = "#10B981" }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const h = 36, w = 120;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${h} ${points} ${w},${h}`} fill={`${color}18`} stroke="none" />
    </svg>
  );
}

// ─── ANOMALY ROW ──────────────────────────────────────────────────────────────
function AnomalyRow({ tx, onAnalyze }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto auto auto",
      alignItems: "center", gap: 12,
      padding: "10px 14px",
      background: "rgba(239,68,68,0.04)",
      border: "1px solid rgba(239,68,68,0.12)",
      borderRadius: 8, marginBottom: 6,
      animation: "fadeUp 0.3s ease",
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 12, color: "#F1F5F9", fontWeight: 500 }}>{tx.description}</p>
        <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>
          {tx.date} · {tx.category}
        </p>
      </div>
      <div style={{
        fontSize: 10, fontFamily: "'DM Mono', monospace",
        color: "#EF4444", fontWeight: 700,
        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
        borderRadius: 4, padding: "2px 7px",
      }}>
        {Math.round(tx.anomalyScore * 100)}% riesgo
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#F87171", fontFamily: "'DM Mono', monospace" }}>
        {fmt(tx.amount)}
      </span>
      <button onClick={() => onAnalyze(tx)} style={{
        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
        borderRadius: 6, padding: "5px 10px", cursor: "pointer",
        fontSize: 11, color: "#FCA5A5", fontFamily: "sans-serif",
        transition: "all 0.15s",
      }}>
        Analizar IA
      </button>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function FinancialDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTx, setSelectedTx] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCat, setFilterCat] = useState("Todas");

  const anomalies = METRICS.anomalies.slice(0, 12);
  const monthlyValues = Object.values(METRICS.monthly);
  const recentTxs = TRANSACTIONS.slice(0, 50).filter(t =>
    (filterCat === "Todas" || t.category === filterCat) &&
    (t.description.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const analyzeAnomaly = async (tx) => {
    setSelectedTx(tx);
    setAiAnalysis("");
    setLoadingAI(true);

    try {
      const avgByCategory = {};
      TRANSACTIONS.filter(t => t.category === tx.category && !t.isAnomaly).forEach(t => {
        if (!avgByCategory[tx.category]) avgByCategory[tx.category] = [];
        avgByCategory[tx.category].push(t.amount);
      });
      const avg = avgByCategory[tx.category]
        ? Math.round(avgByCategory[tx.category].reduce((a, b) => a + b, 0) / avgByCategory[tx.category].length)
        : 0;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `Eres un analista financiero senior especializado en detección de fraudes y anomalías contables. 
Analiza transacciones sospechosas y proporciona un diagnóstico claro y accionable en español.
Sé directo, técnico pero comprensible. Estructura tu respuesta en: 
1) Diagnóstico (2 líneas)
2) Posibles causas (3 bullets)  
3) Riesgo estimado (bajo/medio/alto + justificación)
4) Acción recomendada (1-2 líneas concretas)`,
          messages: [{
            role: "user",
            content: `Analiza esta transacción anómala:
- Descripción: ${tx.description}
- Categoría: ${tx.category}  
- Monto: ${fmt(tx.amount)}
- Fecha: ${tx.date}
- Score de anomalía: ${Math.round(tx.anomalyScore * 100)}%
- Promedio histórico de esta categoría: ${fmt(avg)}
- Desviación del promedio: ${avg > 0 ? Math.round(((tx.amount - avg) / avg) * 100) : "N/A"}%`
          }],
        }),
      });

      const data = await response.json();
      setAiAnalysis(data.content?.[0]?.text || "Error al analizar.");
    } catch {
      setAiAnalysis("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoadingAI(false);
    }
  };

  const generateForecast = async () => {
    setLoadingForecast(true);
    setForecastData(null);

    try {
      const monthlySummary = Object.entries(METRICS.monthly)
        .slice(-3)
        .map(([m, v]) => `${m}: ${fmt(v)}`)
        .join(", ");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `Eres un analista financiero. Responde ÚNICAMENTE con JSON válido sin markdown:
{
  "proyeccion_mes": número en MXN,
  "tendencia": "alcista" | "bajista" | "estable",
  "variacion_esperada": número porcentual,
  "alertas": ["alerta1", "alerta2", "alerta3"],
  "recomendaciones": ["rec1", "rec2", "rec3"],
  "resumen": "2 oraciones de contexto ejecutivo"
}`,
          messages: [{
            role: "user",
            content: `Analiza y proyecta el flujo de caja:
Gasto total 90 días: ${fmt(METRICS.total)}
Últimos 3 meses: ${monthlySummary}
Anomalías detectadas: ${METRICS.anomalies.length} transacciones
Categoría mayor gasto: ${Object.entries(METRICS.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0]}
Total categorías: ${Object.keys(METRICS.byCategory).length}`
          }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      setForecastData(JSON.parse(clean));
    } catch {
      setForecastData({ error: true });
    } finally {
      setLoadingForecast(false);
    }
  };

  const accent = "#10B981";
  const tabStyle = (t) => ({
    padding: "8px 16px", borderRadius: 8, cursor: "pointer",
    fontSize: 12, fontWeight: 600, border: "none",
    fontFamily: "'DM Sans', sans-serif",
    background: activeTab === t ? `${accent}18` : "transparent",
    color: activeTab === t ? accent : "rgba(255,255,255,0.4)",
    transition: "all 0.15s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#080C10", fontFamily: "'DM Sans', sans-serif", padding: "20px 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&family=Bricolage+Grotesque:wght@700;800&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        input:focus { outline: none; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{
              margin: "0 0 4px",
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 800,
              color: "#F0FDF4", letterSpacing: "-0.03em",
            }}>
              Finance<span style={{ color: accent }}>AI</span>
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>
              Dashboard financiero · Detección de anomalías · Proyecciones IA
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["overview", "anomalias", "transacciones", "proyeccion"].map(t => (
              <button key={t} style={tabStyle(t)} onClick={() => setActiveTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* KPI CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Gasto Total 90d", value: fmt(METRICS.total), sub: "Últimos 90 días", color: accent, trend: monthlyValues },
            { label: "Anomalías Detectadas", value: METRICS.anomalies.length, sub: `${Math.round((METRICS.anomalies.length / TRANSACTIONS.length) * 100)}% del total`, color: "#EF4444", alert: true },
            { label: "Mayor Categoría", value: Object.entries(METRICS.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0], sub: fmt(Object.entries(METRICS.byCategory).sort((a, b) => b[1] - a[1])[0]?.[1] || 0), color: "#F59E0B" },
            { label: "Promedio Mensual", value: fmt(METRICS.total / 3), sub: "Últimos 3 meses", color: "#8B5CF6", trend: monthlyValues },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${kpi.alert ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 12, padding: "16px",
              animation: `fadeUp 0.4s ease ${i * 0.08}s both`,
            }}>
              <p style={{ margin: "0 0 8px", fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
                {kpi.label}
              </p>
              <p style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: kpi.color, fontFamily: "'DM Mono', monospace" }}>
                {kpi.alert ? (
                  <span style={{ animation: "pulse 2s infinite" }}>{kpi.value}</span>
                ) : kpi.value}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{kpi.sub}</p>
              {kpi.trend && <div style={{ marginTop: 8 }}><Sparkline values={kpi.trend} color={kpi.color} /></div>}
            </div>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20 }}>
              <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
                Gasto por Categoría
              </p>
              <MiniBarChart data={METRICS.byCategory} />
              <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(METRICS.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: CAT_COLORS[cat] }} />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{cat}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>{fmt(val)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20 }}>
              <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
                Últimas Anomalías
              </p>
              {anomalies.slice(0, 5).map(tx => (
                <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: "#F1F5F9" }}>{tx.category}</p>
                    <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>{tx.date}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#F87171", fontFamily: "'DM Mono', monospace" }}>{fmt(tx.amount)}</span>
                </div>
              ))}
              <button onClick={() => setActiveTab("anomalias")} style={{
                width: "100%", marginTop: 12, padding: "8px",
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 8, color: "#FCA5A5", fontSize: 12, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}>
                Ver todas las anomalías →
              </button>
            </div>
          </div>
        )}

        {/* ANOMALÍAS */}
        {activeTab === "anomalias" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#F1F5F9", fontWeight: 600 }}>
                {anomalies.length} anomalías detectadas por el modelo
              </p>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>
                Ordenadas por score de riesgo
              </span>
            </div>
            {anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore).map(tx => (
              <AnomalyRow key={tx.id} tx={tx} onAnalyze={analyzeAnomaly} />
            ))}

            {/* Panel análisis IA */}
            {selectedTx && (
              <div style={{
                marginTop: 20, padding: 20,
                background: "rgba(16,185,129,0.05)",
                border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: 12, animation: "fadeUp 0.3s ease",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
                    Análisis IA — {selectedTx.description}
                  </p>
                  <button onClick={() => setSelectedTx(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
                {loadingAI ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${accent}40`, borderTop: `2px solid ${accent}`, animation: "fadeUp 1s linear infinite" }} />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Analizando transacción...</span>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: "#D1FAE5", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{aiAnalysis}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TRANSACCIONES */}
        {activeTab === "transacciones" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar transacción..."
                style={{
                  flex: 1, background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "9px 14px",
                  color: "#F1F5F9", fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
              <select
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "9px 14px",
                  color: "#F1F5F9", fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <option style={{ background: "#1a1a2e" }} value="Todas">Todas las categorías</option>
                {Object.keys(CAT_COLORS).map(c => (
                  <option key={c} style={{ background: "#1a1a2e" }} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Descripción", "Categoría", "Fecha", "Monto"].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{h}</span>
                ))}
              </div>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {recentTxs.map(tx => (
                  <div key={tx.id} style={{
                    display: "grid", gridTemplateColumns: "1fr auto auto auto",
                    padding: "10px 16px", alignItems: "center", gap: 12,
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: tx.isAnomaly ? "rgba(239,68,68,0.04)" : "transparent",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {tx.isAnomaly && <span style={{ fontSize: 10, color: "#EF4444" }}>⚠</span>}
                      <span style={{ fontSize: 12, color: "#D1D5DB" }}>{tx.description}</span>
                    </div>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 4,
                      background: `${CAT_COLORS[tx.category]}20`,
                      color: CAT_COLORS[tx.category], fontFamily: "'DM Mono', monospace",
                    }}>{tx.category}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>{tx.date}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tx.isAnomaly ? "#F87171" : "#D1D5DB", fontFamily: "'DM Mono', monospace" }}>
                      {fmt(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PROYECCIÓN */}
        {activeTab === "proyeccion" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            {!forecastData && !loadingForecast && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ fontSize: 40, margin: "0 0 12px" }}>📊</p>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
                  Genera una proyección de flujo de caja con IA basada en tus últimos 90 días
                </p>
                <button onClick={generateForecast} style={{
                  background: `linear-gradient(135deg, ${accent}, #059669)`,
                  border: "none", borderRadius: 10, padding: "13px 32px",
                  fontSize: 14, fontWeight: 700, color: "#fff",
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  boxShadow: `0 0 24px ${accent}40`,
                }}>
                  ⚡ Generar Proyección con IA
                </button>
              </div>
            )}

            {loadingForecast && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${accent}30`, borderTop: `3px solid ${accent}`, animation: "fadeUp 1s linear infinite", margin: "0 auto 16px" }} />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Analizando patrones financieros...</p>
              </div>
            )}

            {forecastData && !forecastData.error && (
              <div style={{ animation: "fadeUp 0.4s ease" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                  {[
                    { label: "Proyección Próximo Mes", value: fmt(forecastData.proyeccion_mes), color: accent },
                    { label: "Tendencia", value: forecastData.tendencia?.toUpperCase(), color: forecastData.tendencia === "alcista" ? "#EF4444" : forecastData.tendencia === "bajista" ? accent : "#F59E0B" },
                    { label: "Variación Esperada", value: `${forecastData.variacion_esperada > 0 ? "+" : ""}${forecastData.variacion_esperada}%`, color: forecastData.variacion_esperada > 0 ? "#EF4444" : accent },
                  ].map((k, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 16 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>{k.label}</p>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: k.color, fontFamily: "'DM Mono', monospace" }}>{k.value}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: 16 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#EF4444", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>⚠ Alertas</p>
                    {forecastData.alertas?.map((a, i) => (
                      <p key={i} style={{ margin: "0 0 6px", fontSize: 12, color: "#FCA5A5", paddingLeft: 12, borderLeft: "2px solid rgba(239,68,68,0.4)" }}>• {a}</p>
                    ))}
                  </div>
                  <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: 16 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>✦ Recomendaciones</p>
                    {forecastData.recomendaciones?.map((r, i) => (
                      <p key={i} style={{ margin: "0 0 6px", fontSize: 12, color: "#D1FAE5", paddingLeft: 12, borderLeft: "2px solid rgba(16,185,129,0.4)" }}>• {r}</p>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 12, padding: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Resumen Ejecutivo</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#D1D5DB", lineHeight: 1.7 }}>{forecastData.resumen}</p>
                </div>
                <button onClick={generateForecast} style={{
                  marginTop: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
                  borderRadius: 8, padding: "9px 18px", fontSize: 12, color: accent,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>
                  Regenerar proyección →
                </button>
              </div>
            )}
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: "rgba(255,255,255,0.1)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>
          FINANCEAI · CLAUDE API · DETECCIÓN DE ANOMALÍAS · PROYECCIONES PREDICTIVAS
        </p>
      </div>
    </div>
  );
}
