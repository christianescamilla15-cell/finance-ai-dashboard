import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ─── STATISTICAL UTILITIES ──────────────────────────────────────────────────
const calcMean = (arr) => arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
const calcStdDev = (arr) => {
  if (arr.length < 2) return 0;
  const m = calcMean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
};

// Linear regression: returns { slope, intercept, r2 }
const linearRegression = (xs, ys) => {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };
  const mx = calcMean(xs);
  const my = calcMean(ys);
  let ssxx = 0, ssxy = 0, ssyy = 0;
  for (let i = 0; i < n; i++) {
    ssxx += (xs[i] - mx) ** 2;
    ssxy += (xs[i] - mx) * (ys[i] - my);
    ssyy += (ys[i] - my) ** 2;
  }
  const slope = ssxx === 0 ? 0 : ssxy / ssxx;
  const intercept = my - slope * mx;
  const r2 = ssyy === 0 ? 0 : (ssxy ** 2) / (ssxx * ssyy);
  return { slope, intercept, r2 };
};

// ─── ANOMALY DETECTION (REAL STATISTICAL) ───────────────────────────────────
const detectAnomalies = (transactions) => {
  // Group amounts by category
  const byCategory = {};
  transactions.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t.amount);
  });

  // Global stats as fallback
  const allAmounts = transactions.map(t => t.amount);
  const globalMean = calcMean(allAmounts);
  const globalStdDev = calcStdDev(allAmounts);

  // Category stats
  const catStats = {};
  for (const [cat, amounts] of Object.entries(byCategory)) {
    catStats[cat] = {
      mean: calcMean(amounts),
      stddev: calcStdDev(amounts),
      count: amounts.length,
    };
  }

  return transactions.map(t => {
    const stats = catStats[t.category];
    const useGlobal = !stats || stats.count < 3 || stats.stddev === 0;
    const mean = useGlobal ? globalMean : stats.mean;
    const stddev = useGlobal ? globalStdDev : stats.stddev;

    const deviation = stddev === 0 ? 0 : Math.abs(t.amount - mean) / stddev;
    const isAnomaly = deviation > 2;
    // Normalize anomaly score to 0-1 range (cap at 5 stddevs)
    const anomalyScore = Math.min(deviation / 5, 1);

    return {
      ...t,
      isAnomaly,
      anomalyScore: Math.round(anomalyScore * 100) / 100,
      _catMean: Math.round(mean),
      _catStdDev: Math.round(stddev),
      _deviation: Math.round(deviation * 100) / 100,
    };
  });
};

// ─── CSV / TEXT PARSER ───────────────────────────────────────────────────────
const parseImportData = (text, delimiter = null) => {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return { transactions: [], error: "Se necesitan al menos 2 lineas (encabezado + datos)" };

  // Auto-detect delimiter
  if (!delimiter) {
    const firstLine = lines[0];
    if (firstLine.includes("\t")) delimiter = "\t";
    else if (firstLine.includes(";")) delimiter = ";";
    else delimiter = ",";
  }

  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));

  // Map common header names
  const dateIdx = headers.findIndex(h => ["date", "fecha", "date_time", "fecha_hora"].includes(h));
  const catIdx = headers.findIndex(h => ["category", "categoria", "categoría", "cat", "tipo"].includes(h));
  const amountIdx = headers.findIndex(h => ["amount", "monto", "cantidad", "importe", "valor"].includes(h));
  const descIdx = headers.findIndex(h => ["description", "descripcion", "descripción", "desc", "concepto", "detalle"].includes(h));

  if (dateIdx === -1 || amountIdx === -1) {
    return { transactions: [], error: "Se requieren al menos las columnas 'fecha' y 'monto'. Columnas detectadas: " + headers.join(", ") };
  }

  const transactions = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^['"]|['"]$/g, ""));
    if (cols.length < Math.max(dateIdx, amountIdx) + 1) {
      errors.push(`Linea ${i + 1}: columnas insuficientes`);
      continue;
    }

    // Parse date — support various formats
    let dateStr = cols[dateIdx];
    let parsedDate;
    // Try DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = dateStr.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
    if (dmyMatch) {
      parsedDate = new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`);
    } else {
      parsedDate = new Date(dateStr);
    }

    if (isNaN(parsedDate.getTime())) {
      errors.push(`Linea ${i + 1}: fecha invalida '${dateStr}'`);
      continue;
    }

    // Parse amount — handle commas as decimals, currency symbols
    let amountStr = cols[amountIdx].replace(/[$€£MXN\s]/gi, "").replace(/,(\d{2})$/, ".$1").replace(/,/g, "");
    const amount = Math.round(Math.abs(parseFloat(amountStr)));
    if (isNaN(amount) || amount === 0) {
      errors.push(`Linea ${i + 1}: monto invalido '${cols[amountIdx]}'`);
      continue;
    }

    const category = catIdx !== -1 && cols[catIdx] ? cols[catIdx] : "General";
    const description = descIdx !== -1 && cols[descIdx] ? cols[descIdx] : `${category} — Transaccion #${i}`;

    transactions.push({
      id: `IMP-${Date.now()}-${i}`,
      date: parsedDate.toISOString().split("T")[0],
      category,
      amount,
      description,
    });
  }

  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { transactions, errors: errors.length > 0 ? errors : null };
};

// ─── DATA MOCK ────────────────────────────────────────────────────────────────
const generateMockTransactions = () => {
  const categories = ["Marketing", "Nomina", "Software", "Infraestructura", "Logistica", "Ventas", "Operaciones"];
  const transactions = [];
  const now = new Date();

  for (let i = 89; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const count = Math.floor(Math.random() * 4) + 1;
    for (let j = 0; j < count; j++) {
      const cat = categories[Math.floor(Math.random() * categories.length)];
      const base = { Marketing: 8000, Nomina: 45000, Software: 3500, Infraestructura: 12000, Logistica: 6000, Ventas: 15000, Operaciones: 9000 };
      const variance = 0.25;
      let amount = base[cat] * (1 + (Math.random() - 0.5) * variance);
      // Inject some real outliers for the statistical detector to find
      if (Math.random() < 0.06) amount *= (Math.random() > 0.5 ? 3.2 : 0.15);
      transactions.push({
        id: `TX-${Date.now()}-${i}-${j}`,
        date: date.toISOString().split("T")[0],
        category: cat,
        amount: Math.round(amount),
        description: `${cat} — ${["Factura", "Pago", "Transferencia", "Cargo"][Math.floor(Math.random() * 4)]} #${Math.floor(Math.random() * 9000) + 1000}`,
      });
    }
  }
  return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
};

const INITIAL_MOCK = generateMockTransactions();

// ─── METRICS ─────────────────────────────────────────────────────────────────
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
  // Category stats for analysis
  const catStats = {};
  txs.forEach(t => {
    if (!catStats[t.category]) catStats[t.category] = [];
    catStats[t.category].push(t.amount);
  });
  const categoryStats = {};
  for (const [cat, amounts] of Object.entries(catStats)) {
    categoryStats[cat] = { mean: calcMean(amounts), stddev: calcStdDev(amounts), count: amounts.length };
  }
  return { total, anomalies, byCategory, monthly, categoryStats };
};

// ─── COLORES ──────────────────────────────────────────────────────────────────
const CAT_COLORS = {
  Marketing: "#3B82F6", Nomina: "#10B981", Software: "#8B5CF6",
  Infraestructura: "#F59E0B", Logistica: "#EF4444", Ventas: "#06B6D4", Operaciones: "#EC4899",
  General: "#6B7280",
};

const getCatColor = (cat) => CAT_COLORS[cat] || `hsl(${cat.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 55%, 55%)`;

const fmt = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

// ─── ANIMATED COUNTER ─────────────────────────────────────────────────────────
function AnimatedValue({ value, prefix = "", suffix = "" }) {
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

// ─── MINI BAR CHART ───────────────────────────────────────────────────────────
function MiniBarChart({ data }) {
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

// ─── SPARKLINE WITH TOOLTIP ──────────────────────────────────────────────────
function Sparkline({ values, color = "#10B981" }) {
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

// ─── SKELETON PLACEHOLDER ────────────────────────────────────────────────────
function Skeleton({ width = "100%", height = 16, style: extraStyle = {} }) {
  return (
    <div style={{
      width, height, borderRadius: 6,
      background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      ...extraStyle,
    }} />
  );
}

// ─── ANOMALY ROW ──────────────────────────────────────────────────────────────
function AnomalyRow({ tx, onAnalyze, isHighlighted, rowRef }) {
  return (
    <div ref={rowRef} style={{
      display: "grid", gridTemplateColumns: "1fr auto auto auto",
      alignItems: "center", gap: 12,
      padding: "10px 14px",
      background: isHighlighted ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.04)",
      border: `1px solid ${isHighlighted ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.12)"}`,
      borderRadius: 8, marginBottom: 6,
      animation: "fadeUp 0.3s ease",
      transition: "all 0.3s ease",
      cursor: "pointer",
    }} onClick={() => onAnalyze(tx)}>
      <div>
        <p style={{ margin: 0, fontSize: 12, color: "#F1F5F9", fontWeight: 500 }}>{tx.description}</p>
        <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>
          {tx.date} · {tx.category} · {tx._deviation ? `${tx._deviation}σ desviacion` : ""}
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
      <button onClick={(e) => { e.stopPropagation(); onAnalyze(tx); }} style={{
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

// ─── DATA IMPORT PANEL ──────────────────────────────────────────────────────
function ImportPanel({ onImport }) {
  const [mode, setMode] = useState(null); // null, "csv", "paste"
  const [pasteText, setPasteText] = useState("");
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const handleCSVUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      processImport(text);
    };
    reader.readAsText(file);
  };

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    processImport(pasteText);
  };

  const processImport = (text) => {
    const result = parseImportData(text);
    setImportResult(result);
    if (result.transactions.length > 0) {
      const dates = result.transactions.map(t => t.date).sort();
      setImportResult({
        ...result,
        summary: `${result.transactions.length} transacciones importadas, rango: ${dates[0]} - ${dates[dates.length - 1]}`,
      });
    }
  };

  const confirmImport = () => {
    if (importResult?.transactions?.length > 0) {
      onImport(importResult.transactions);
      setMode(null);
      setPasteText("");
      setImportResult(null);
    }
  };

  const accent = "#10B981";

  if (mode === null) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => setMode("csv")} style={{
          background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: 8, padding: "7px 14px", cursor: "pointer",
          fontSize: 11, fontWeight: 600, color: accent, fontFamily: "'DM Sans', sans-serif",
        }}>
          Importar CSV
        </button>
        <button onClick={() => setMode("paste")} style={{
          background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)",
          borderRadius: 8, padding: "7px 14px", cursor: "pointer",
          fontSize: 11, fontWeight: 600, color: "#8B5CF6", fontFamily: "'DM Sans', sans-serif",
        }}>
          Pegar datos
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: 20, marginBottom: 16, animation: "fadeUp 0.3s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>
          {mode === "csv" ? "Importar archivo CSV" : "Pegar datos"}
        </p>
        <button onClick={() => { setMode(null); setImportResult(null); setPasteText(""); }} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16,
        }}>X</button>
      </div>

      {/* Example format */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8, padding: 12, marginBottom: 14, fontFamily: "'DM Mono', monospace", fontSize: 10,
        color: "rgba(255,255,255,0.4)", lineHeight: 1.8,
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 700 }}>FORMATO ESPERADO (CSV o tab-separado):</p>
        fecha,categoria,monto,descripcion<br/>
        2025-01-15,Marketing,8500,Campana Google Ads<br/>
        2025-01-16,Software,3200,Licencia Figma<br/>
        2025-01-17,Nomina,45000,Pago quincenal<br/>
        <p style={{ margin: "8px 0 0", fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
          Columnas minimas: fecha + monto. Acepta formatos: YYYY-MM-DD, DD/MM/YYYY. Separadores: coma, tab, punto y coma.
        </p>
      </div>

      {mode === "csv" && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleCSVUpload}
            style={{ display: "none" }}
          />
          <button onClick={() => fileRef.current?.click()} style={{
            background: `linear-gradient(135deg, ${accent}, #059669)`,
            border: "none", borderRadius: 8, padding: "10px 24px",
            fontSize: 12, fontWeight: 700, color: "#fff",
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>
            Seleccionar archivo CSV
          </button>
        </div>
      )}

      {mode === "paste" && (
        <div>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={"fecha,categoria,monto,descripcion\n2025-01-15,Marketing,8500,Campana Google Ads\n2025-01-16,Software,3200,Licencia Figma"}
            rows={8}
            style={{
              width: "100%", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: 12,
              color: "#F1F5F9", fontSize: 12,
              fontFamily: "'DM Mono', monospace",
              resize: "vertical",
            }}
          />
          <button onClick={handlePaste} style={{
            marginTop: 8,
            background: `linear-gradient(135deg, #8B5CF6, #6D28D9)`,
            border: "none", borderRadius: 8, padding: "10px 24px",
            fontSize: 12, fontWeight: 700, color: "#fff",
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>
            Procesar datos
          </button>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div style={{ marginTop: 14 }}>
          {importResult.error && (
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "#FCA5A5" }}>Error: {importResult.error}</p>
          )}
          {importResult.errors && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#F59E0B" }}>Advertencias ({importResult.errors.length}):</p>
              {importResult.errors.slice(0, 5).map((err, i) => (
                <p key={i} style={{ margin: 0, fontSize: 10, color: "rgba(245,158,11,0.7)", fontFamily: "'DM Mono', monospace" }}>- {err}</p>
              ))}
              {importResult.errors.length > 5 && (
                <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>...y {importResult.errors.length - 5} mas</p>
              )}
            </div>
          )}
          {importResult.summary && (
            <div style={{
              background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <p style={{ margin: 0, fontSize: 12, color: accent, fontWeight: 600 }}>
                {importResult.summary}
              </p>
              <button onClick={confirmImport} style={{
                background: `linear-gradient(135deg, ${accent}, #059669)`,
                border: "none", borderRadius: 8, padding: "8px 20px",
                fontSize: 12, fontWeight: 700, color: "#fff",
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                boxShadow: `0 0 16px ${accent}30`,
              }}>
                Confirmar importacion
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── REAL ANOMALY ANALYSIS (client-side) ─────────────────────────────────────
function generateRealAnalysis(tx, allTransactions) {
  const catTxs = allTransactions.filter(t => t.category === tx.category);
  const catAmounts = catTxs.map(t => t.amount);
  const mean = calcMean(catAmounts);
  const stddev = calcStdDev(catAmounts);
  const deviation = stddev > 0 ? (tx.amount - mean) / stddev : 0;
  const isHigh = tx.amount > mean;
  const pctDeviation = mean > 0 ? Math.round(((tx.amount - mean) / mean) * 100) : 0;
  const riskScore = Math.round(tx.anomalyScore * 100);

  // Historical monthly pattern for category
  const monthlyByCat = {};
  catTxs.forEach(t => {
    const m = t.date.slice(0, 7);
    if (!monthlyByCat[m]) monthlyByCat[m] = 0;
    monthlyByCat[m] += t.amount;
  });
  const monthlyValues = Object.values(monthlyByCat);
  const monthlyMean = calcMean(monthlyValues);
  const monthlyStdDev = calcStdDev(monthlyValues);

  // Determine risk level from actual anomaly score
  let riskLevel, riskColor;
  if (riskScore >= 70) { riskLevel = "ALTO"; riskColor = "#EF4444"; }
  else if (riskScore >= 40) { riskLevel = "MEDIO"; riskColor = "#F59E0B"; }
  else { riskLevel = "BAJO"; riskColor = "#10B981"; }

  // Generate causes based on deviation type
  const highCauses = [
    `Posible cargo duplicado: el monto de ${fmt(tx.amount)} es ${Math.abs(pctDeviation)}% superior al promedio de ${fmt(Math.round(mean))} para ${tx.category}`,
    `Desviacion de ${Math.abs(Math.round(deviation * 100) / 100)} desviaciones estandar — estadisticamente significativo (umbral: 2σ)`,
    `En los ultimos ${catTxs.length} registros de ${tx.category}, solo ${catTxs.filter(t => t.amount > mean + 2 * stddev).length} transacciones superan este umbral`,
  ];
  const lowCauses = [
    `Monto de ${fmt(tx.amount)} es ${Math.abs(pctDeviation)}% inferior al promedio de ${fmt(Math.round(mean))} para ${tx.category}`,
    `Desviacion de ${Math.abs(Math.round(deviation * 100) / 100)} desviaciones estandar por debajo de la media`,
    `Posible pago parcial o cancelacion no documentada — comparar con registros anteriores de ${tx.category}`,
  ];

  // Action based on severity
  let action;
  if (riskScore >= 70) {
    action = `ACCION INMEDIATA: Verificar con el responsable de ${tx.category} la legitimidad de esta transaccion. Solicitar documentacion de respaldo antes de ${tx.date}. Si no hay justificacion, escalar a auditoria interna.`;
  } else if (riskScore >= 40) {
    action = `MONITOREAR: Agregar esta transaccion al seguimiento semanal. Comparar con las proximas ${catTxs.length > 10 ? "10" : catTxs.length} transacciones de ${tx.category} para confirmar si es una tendencia o evento aislado.`;
  } else {
    action = `REGISTRAR: Documentar la desviacion para el reporte mensual. No requiere accion inmediata pero incluir en la revision trimestral de ${tx.category}.`;
  }

  return `DIAGNOSTICO
Esta transaccion de ${tx.category} por ${fmt(tx.amount)} es ${Math.abs(pctDeviation)}% ${isHigh ? "superior" : "inferior"} al promedio de ${fmt(Math.round(mean))} para esta categoria. La desviacion estandar de ${tx.category} es ${fmt(Math.round(stddev))}, y este monto se encuentra a ${Math.abs(Math.round(deviation * 100) / 100)} desviaciones estandar de la media.${catTxs.length < 10 ? ` (Nota: basado en solo ${catTxs.length} transacciones — precision limitada)` : ""}

ANALISIS ESTADISTICO
- Media de ${tx.category}: ${fmt(Math.round(mean))}
- Desviacion estandar: ${fmt(Math.round(stddev))}
- Rango normal (media +/- 2σ): ${fmt(Math.round(mean - 2 * stddev))} — ${fmt(Math.round(mean + 2 * stddev))}
- Esta transaccion: ${fmt(tx.amount)} (${Math.abs(Math.round(deviation * 100) / 100)}σ ${isHigh ? "por encima" : "por debajo"})
- Total transacciones en ${tx.category}: ${catTxs.length}

CAUSAS POSIBLES
${(isHigh ? highCauses : lowCauses).map(c => `- ${c}`).join("\n")}

RIESGO ESTIMADO: ${riskLevel}
Score de anomalia: ${riskScore}% — basado en la distancia normalizada respecto a la media (${Math.abs(Math.round(deviation * 100) / 100)}σ / 5σ maximo).${monthlyStdDev > 0 ? ` El gasto mensual de ${tx.category} tiene una variabilidad de ${fmt(Math.round(monthlyStdDev))} mensual.` : ""}

ACCION RECOMENDADA
${action}`;
}

// ─── REAL FORECAST (client-side linear regression) ──────────────────────────
function generateRealForecast(transactions, metrics) {
  const monthlyEntries = Object.entries(metrics.monthly).sort((a, b) => a[0].localeCompare(b[0]));
  if (monthlyEntries.length < 2) {
    return { error: "Datos insuficientes para generar una proyeccion. Se requieren al menos 2 meses de historial." };
  }

  const ys = monthlyEntries.map(e => e[1]);
  const xs = monthlyEntries.map((_, i) => i);

  // Linear regression on monthly totals
  const reg = linearRegression(xs, ys);
  const nextIdx = xs.length;
  const projectedAmount = Math.round(reg.slope * nextIdx + reg.intercept);

  // Month-over-month growth rates
  const growthRates = [];
  for (let i = 1; i < ys.length; i++) {
    growthRates.push(ys[i - 1] !== 0 ? ((ys[i] - ys[i - 1]) / ys[i - 1]) * 100 : 0);
  }
  const avgGrowth = calcMean(growthRates);
  const lastGrowth = growthRates.length > 0 ? growthRates[growthRates.length - 1] : 0;

  // Trend
  let trend;
  if (reg.slope > 0 && avgGrowth > 3) trend = "alcista";
  else if (reg.slope < 0 && avgGrowth < -3) trend = "bajista";
  else trend = "estable";

  const variacion = Math.round(avgGrowth);

  // Category trends
  const catMonthly = {};
  transactions.forEach(t => {
    const m = t.date.slice(0, 7);
    const key = `${t.category}|${m}`;
    if (!catMonthly[key]) catMonthly[key] = 0;
    catMonthly[key] += t.amount;
  });

  const months = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort();
  const categories = [...new Set(transactions.map(t => t.category))];

  const catTrends = {};
  categories.forEach(cat => {
    const catMonths = months.map(m => catMonthly[`${cat}|${m}`] || 0).filter(v => v > 0);
    if (catMonths.length >= 2) {
      const lastTwo = catMonths.slice(-2);
      const change = lastTwo[0] !== 0 ? ((lastTwo[1] - lastTwo[0]) / lastTwo[0]) * 100 : 0;
      catTrends[cat] = Math.round(change);
    }
  });

  // Generate alerts based on real patterns
  const alertas = [];

  // Alert: categories growing fast
  const growingCats = Object.entries(catTrends).filter(([, ch]) => ch > 25).sort((a, b) => b[1] - a[1]);
  if (growingCats.length > 0) {
    alertas.push(`${growingCats[0][0]} aumento un ${growingCats[0][1]}% mes a mes — revisar si el incremento es justificado`);
  }

  // Alert: category concentration
  const topCategory = Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1])[0];
  if (topCategory) {
    const pct = Math.round((topCategory[1] / metrics.total) * 100);
    if (pct > 30) {
      alertas.push(`${topCategory[0]} concentra el ${pct}% del gasto total — riesgo de dependencia excesiva`);
    }
  }

  // Alert: anomaly rate
  const anomalyRate = metrics.anomalies.length / transactions.length;
  if (anomalyRate > 0.03) {
    alertas.push(`Tasa de anomalias del ${Math.round(anomalyRate * 100)}% (${metrics.anomalies.length} de ${transactions.length}) — supera el umbral recomendado del 3%`);
  }

  // Alert: high variability
  const monthlyStdDev = calcStdDev(ys);
  const monthlyMean = calcMean(ys);
  if (monthlyMean > 0 && (monthlyStdDev / monthlyMean) > 0.2) {
    alertas.push(`Alta variabilidad mensual (CV: ${Math.round((monthlyStdDev / monthlyMean) * 100)}%) — dificulta la prediccion precisa`);
  }

  if (alertas.length === 0) alertas.push("No se detectaron patrones de riesgo significativos en el periodo analizado");

  // Shrinking categories
  const shrinkingCats = Object.entries(catTrends).filter(([, ch]) => ch < -15).sort((a, b) => a[1] - b[1]);

  // Recommendations based on real data
  const recomendaciones = [];
  if (growingCats.length > 0) {
    recomendaciones.push(`Revisar contratos de ${growingCats[0][0]} — crecimiento del ${growingCats[0][1]}% puede indicar sobrecoste o nueva necesidad no presupuestada`);
  }
  if (shrinkingCats.length > 0) {
    recomendaciones.push(`Investigar la reduccion en ${shrinkingCats[0][0]} (${shrinkingCats[0][1]}%) — verificar que no afecte la operacion`);
  }
  recomendaciones.push(`Presupuesto sugerido proximo mes: ${fmt(projectedAmount)} (basado en regresion lineal, R²=${Math.round(reg.r2 * 100)}%)`);
  if (reg.r2 < 0.5) {
    recomendaciones.push(`El modelo de regresion tiene R²=${Math.round(reg.r2 * 100)}% — los datos son muy variables, considerar metodos adicionales de proyeccion`);
  }

  // Summary
  const lastMonth = monthlyEntries[monthlyEntries.length - 1];
  const resumen = `Analisis de ${monthlyEntries.length} meses con gasto total de ${fmt(metrics.total)}. ` +
    `Tendencia ${trend} con crecimiento promedio mensual de ${variacion > 0 ? "+" : ""}${variacion}%. ` +
    `Ultimo mes registrado (${lastMonth[0]}): ${fmt(lastMonth[1])}. ` +
    `Proyeccion para el proximo mes basada en regresion lineal: ${fmt(projectedAmount)} (R²=${Math.round(reg.r2 * 100)}%).`;

  return {
    proyeccion_mes: projectedAmount > 0 ? projectedAmount : Math.round(lastMonth[1] * (1 + variacion / 100)),
    tendencia: trend,
    variacion_esperada: variacion,
    alertas,
    recomendaciones,
    resumen,
    catTrends,
    regression: reg,
  };
}

// ─── APP ──────────────────────────────────────────────────────────────────────
function ContactBar() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem('cta-dismissed')) return;
    const timer = setTimeout(() => setShow(true), 10000);
    return () => clearTimeout(timer);
  }, []);
  if (dismissed || !show) return null;
  const dismiss = () => { setDismissed(true); sessionStorage.setItem('cta-dismissed', '1'); };
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(99,102,241,0.2)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', animation: 'slideUpCTA 0.4s ease', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes slideUpCTA { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <span style={{ color: '#E2E8F0', fontSize: 14, fontWeight: 500 }}>Esto es una demo gratuita de Impulso IA 👋 ¿Quieres algo así para tu negocio?</span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <a href="https://impulso-ia-navy.vercel.app/#contacto" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 18px', borderRadius: 8, background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'transform 0.2s' }}>Platiquemos</a>
        <a href="https://wa.me/525579605324?text=Hola%20Christian%2C%20me%20interesa%20saber%20m%C3%A1s%20sobre%20tus%20servicios%20de%20IA" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>WhatsApp</a>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
      </div>
    </div>
  );
}

export default function FinancialDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTx, setSelectedTx] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState("");
  const [forecastData, setForecastData] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCat, setFilterCat] = useState("Todas");
  const [rawTransactions, setRawTransactions] = useState(INITIAL_MOCK);
  const [dataSource, setDataSource] = useState("mock"); // "mock" or "imported"
  const [importSummary, setImportSummary] = useState(null);

  const analysisRef = useRef(null);
  const anomalyRowRefs = useRef({});

  // Apply real anomaly detection to all transactions
  const transactions = useMemo(() => detectAnomalies(rawTransactions), [rawTransactions]);
  const metrics = useMemo(() => computeMetrics(transactions), [transactions]);

  const anomalies = useMemo(() => transactions.filter(t => t.isAnomaly).slice(0, 20), [transactions]);
  const monthlyValues = useMemo(() => Object.values(metrics.monthly), [metrics]);

  // Get all unique categories from current data
  const allCategories = useMemo(() => [...new Set(transactions.map(t => t.category))].sort(), [transactions]);

  const recentTxs = useMemo(() => transactions.slice(0, 50).filter(t =>
    (filterCat === "Todas" || t.category === filterCat) &&
    (t.description.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase()))
  ), [transactions, filterCat, searchTerm]);

  const handleImport = useCallback((imported) => {
    setRawTransactions(imported);
    setDataSource("imported");
    const dates = imported.map(t => t.date).sort();
    setImportSummary(`${imported.length} transacciones importadas (${dates[0]} a ${dates[dates.length - 1]})`);
    // Reset analysis state
    setSelectedTx(null);
    setAiAnalysis("");
    setForecastData(null);
    setFilterCat("Todas");
    setSearchTerm("");
  }, []);

  const handleResetToMock = useCallback(() => {
    setRawTransactions(INITIAL_MOCK);
    setDataSource("mock");
    setImportSummary(null);
    setSelectedTx(null);
    setAiAnalysis("");
    setForecastData(null);
    setFilterCat("Todas");
    setSearchTerm("");
  }, []);

  const analyzeAnomaly = async (tx) => {
    setSelectedTx(tx);
    setAiAnalysis("");
    setAiError("");
    setLoadingAI(true);

    setTimeout(() => {
      analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);

    // Simulate brief "thinking" time then generate real statistical analysis
    await new Promise(r => setTimeout(r, 1200));
    const analysis = generateRealAnalysis(tx, transactions);
    setAiAnalysis(analysis);
    setLoadingAI(false);
  };

  const generateForecast = async () => {
    setLoadingForecast(true);
    setForecastData(null);
    setForecastError("");

    await new Promise(r => setTimeout(r, 1500));

    const result = generateRealForecast(transactions, metrics);
    if (result.error) {
      setForecastError(result.error);
    } else {
      setForecastData(result);
    }
    setLoadingForecast(false);
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
    <>
    <div style={{ minHeight: "100vh", background: "#080C10", fontFamily: "'DM Sans', sans-serif", padding: "20px 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&family=Bricolage+Grotesque:wght@700;800&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        @keyframes spinAnim { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        input:focus, select:focus, textarea:focus { outline: none; }
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
              Dashboard financiero · Deteccion de anomalias · Proyecciones IA
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

        {/* DATA SOURCE BANNER + IMPORT */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 16, padding: "10px 16px",
          background: dataSource === "imported" ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.02)",
          border: `1px solid ${dataSource === "imported" ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.06)"}`,
          borderRadius: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: dataSource === "imported" ? "#8B5CF6" : "rgba(255,255,255,0.2)",
            }} />
            <span style={{ fontSize: 11, color: dataSource === "imported" ? "#C4B5FD" : "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace" }}>
              {dataSource === "imported"
                ? importSummary
                : `Datos demo: ${transactions.length} transacciones generadas · ${anomalies.length} anomalias detectadas`}
            </span>
            {dataSource === "imported" && (
              <button onClick={handleResetToMock} style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6, padding: "3px 10px", cursor: "pointer",
                fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif",
              }}>
                Volver a demo
              </button>
            )}
          </div>
          <ImportPanel onImport={handleImport} />
        </div>

        {/* KPI CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Gasto Total", value: fmt(metrics.total), rawValue: metrics.total, sub: `${Object.keys(metrics.monthly).length} meses de datos`, color: accent, trend: monthlyValues, isCurrency: true },
            { label: "Anomalias Detectadas", value: String(anomalies.length), rawValue: anomalies.length, sub: `${transactions.length > 0 ? Math.round((anomalies.length / transactions.length) * 100) : 0}% del total (umbral: 2σ)`, color: "#EF4444", alert: true },
            { label: "Mayor Categoria", value: Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A", sub: fmt(Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1])[0]?.[1] || 0), color: "#F59E0B", isText: true },
            { label: "Promedio Mensual", value: fmt(metrics.total / Math.max(Object.keys(metrics.monthly).length, 1)), rawValue: Math.round(metrics.total / Math.max(Object.keys(metrics.monthly).length, 1)), sub: `${Object.keys(metrics.monthly).length} meses`, color: "#8B5CF6", trend: monthlyValues, isCurrency: true },
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
                  <span style={{ animation: anomalies.length > 0 ? "pulse 2s infinite" : "none" }}>
                    <AnimatedValue value={kpi.rawValue} />
                  </span>
                ) : kpi.isText ? kpi.value : (
                  <AnimatedValue value={kpi.rawValue || kpi.value} />
                )}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{kpi.sub}</p>
              {kpi.trend && kpi.trend.length > 1 && <div style={{ marginTop: 8 }}><Sparkline values={kpi.trend} color={kpi.color} /></div>}
            </div>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20 }}>
              <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
                Gasto por Categoria
              </p>
              <MiniBarChart data={metrics.byCategory} />
              <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: getCatColor(cat) }} />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{cat}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>{fmt(val)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20 }}>
              <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
                Ultimas Anomalias
              </p>
              {anomalies.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <p style={{ fontSize: 24, margin: "0 0 8px" }}>OK</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>No se detectaron anomalias estadisticas (umbral: 2 desv. estandar)</p>
                </div>
              ) : (
                anomalies.slice(0, 5).map(tx => (
                  <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: "#F1F5F9" }}>{tx.category}</p>
                      <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>{tx.date} · {tx._deviation}σ</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#F87171", fontFamily: "'DM Mono', monospace" }}>{fmt(tx.amount)}</span>
                  </div>
                ))
              )}
              {anomalies.length > 0 && (
                <button onClick={() => setActiveTab("anomalias")} style={{
                  width: "100%", marginTop: 12, padding: "8px",
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8, color: "#FCA5A5", fontSize: 12, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  Ver todas las anomalias
                </button>
              )}
            </div>
          </div>
        )}

        {/* ANOMALIAS */}
        {activeTab === "anomalias" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#F1F5F9", fontWeight: 600 }}>
                {anomalies.length > 0
                  ? `${anomalies.length} anomalias detectadas (> 2 desviaciones estandar)`
                  : "No se detectaron anomalias estadisticas"}
              </p>
              {anomalies.length > 0 && (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>
                  Ordenadas por score de riesgo
                </span>
              )}
            </div>

            {anomalies.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "48px 20px",
                background: "rgba(16,185,129,0.05)",
                border: "1px solid rgba(16,185,129,0.15)",
                borderRadius: 12,
              }}>
                <p style={{ fontSize: 36, margin: "0 0 12px" }}>OK</p>
                <p style={{ fontSize: 15, color: accent, fontWeight: 600, margin: "0 0 6px" }}>
                  No se detectaron anomalias
                </p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                  Todas las transacciones estan dentro de 2 desviaciones estandar de su media por categoria.
                </p>
              </div>
            ) : (
              anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore).map(tx => (
                <AnomalyRow
                  key={tx.id}
                  tx={tx}
                  onAnalyze={analyzeAnomaly}
                  isHighlighted={selectedTx?.id === tx.id}
                  rowRef={el => { anomalyRowRefs.current[tx.id] = el; }}
                />
              ))
            )}

            {/* Panel analisis IA */}
            {selectedTx && (
              <div ref={analysisRef} style={{
                marginTop: 20, padding: 20,
                background: "rgba(16,185,129,0.05)",
                border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: 12, animation: "fadeUp 0.3s ease",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
                    Analisis Estadistico — {selectedTx.description}
                  </p>
                  <button onClick={() => setSelectedTx(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16 }}>X</button>
                </div>
                {loadingAI ? (
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${accent}40`, borderTop: `2px solid ${accent}`, animation: "spinAnim 1s linear infinite" }} />
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Calculando estadisticas...</span>
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
                    <button onClick={() => analyzeAnomaly(selectedTx)} style={{
                      background: "rgba(16,185,129,0.12)", border: `1px solid ${accent}40`,
                      borderRadius: 6, padding: "7px 18px", cursor: "pointer",
                      fontSize: 12, color: accent, fontFamily: "'DM Sans', sans-serif",
                    }}>
                      Reintentar analisis
                    </button>
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
                placeholder="Buscar transaccion..."
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
                <option style={{ background: "#1a1a2e" }} value="Todas">Todas las categorias</option>
                {allCategories.map(c => (
                  <option key={c} style={{ background: "#1a1a2e" }} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Descripcion", "Categoria", "Fecha", "Monto"].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{h}</span>
                ))}
              </div>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {recentTxs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0" }}>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                      No se encontraron transacciones con los filtros aplicados.
                    </p>
                  </div>
                ) : (
                  recentTxs.map(tx => (
                    <div key={tx.id} style={{
                      display: "grid", gridTemplateColumns: "1fr auto auto auto",
                      padding: "10px 16px", alignItems: "center", gap: 12,
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: tx.isAnomaly ? "rgba(239,68,68,0.04)" : "transparent",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {tx.isAnomaly && <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 700 }}>!</span>}
                        <span style={{ fontSize: 12, color: "#D1D5DB" }}>{tx.description}</span>
                      </div>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 4,
                        background: `${getCatColor(tx.category)}20`,
                        color: getCatColor(tx.category), fontFamily: "'DM Mono', monospace",
                      }}>{tx.category}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>{tx.date}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tx.isAnomaly ? "#F87171" : "#D1D5DB", fontFamily: "'DM Mono', monospace" }}>
                        {fmt(tx.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* PROYECCION */}
        {activeTab === "proyeccion" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            {!forecastData && !loadingForecast && !forecastError && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ fontSize: 18, margin: "0 0 12px", color: "rgba(255,255,255,0.3)" }}>Proyeccion Financiera</p>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
                  Genera una proyeccion basada en regresion lineal de tus datos {dataSource === "imported" ? "importados" : "de los ultimos 90 dias"}
                </p>
                <button onClick={generateForecast} style={{
                  background: `linear-gradient(135deg, ${accent}, #059669)`,
                  border: "none", borderRadius: 10, padding: "13px 32px",
                  fontSize: 14, fontWeight: 700, color: "#fff",
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  boxShadow: `0 0 24px ${accent}40`,
                }}>
                  Generar Proyeccion
                </button>
              </div>
            )}

            {loadingForecast && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${accent}30`, borderTop: `3px solid ${accent}`, animation: "spinAnim 1s linear infinite", margin: "0 auto 16px" }} />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "0 0 24px" }}>Calculando regresion lineal y tendencias...</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 16 }}>
                      <Skeleton height={10} width="60%" style={{ marginBottom: 10 }} />
                      <Skeleton height={22} width="80%" />
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[1, 2].map(i => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 16 }}>
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
                <button onClick={generateForecast} style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 8, padding: "10px 24px", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, color: "#FCA5A5",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  Reintentar
                </button>
              </div>
            )}

            {forecastData && !forecastData.error && (
              <div style={{ animation: "fadeUp 0.4s ease" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                  {[
                    { label: "Proyeccion Proximo Mes", value: fmt(forecastData.proyeccion_mes), color: accent },
                    { label: "Tendencia", value: forecastData.tendencia?.toUpperCase(), color: forecastData.tendencia === "alcista" ? "#EF4444" : forecastData.tendencia === "bajista" ? accent : "#F59E0B" },
                    { label: "Variacion Esperada", value: `${forecastData.variacion_esperada > 0 ? "+" : ""}${forecastData.variacion_esperada}%`, color: forecastData.variacion_esperada > 0 ? "#EF4444" : accent },
                  ].map((k, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 16 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>{k.label}</p>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: k.color, fontFamily: "'DM Mono', monospace" }}>{k.value}</p>
                    </div>
                  ))}
                </div>

                {/* Category trends */}
                {forecastData.catTrends && Object.keys(forecastData.catTrends).length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>Tendencias por Categoria (mes a mes)</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {Object.entries(forecastData.catTrends).sort((a, b) => b[1] - a[1]).map(([cat, change]) => (
                        <div key={cat} style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "4px 10px", borderRadius: 6,
                          background: change > 15 ? "rgba(239,68,68,0.08)" : change < -15 ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${change > 15 ? "rgba(239,68,68,0.15)" : change < -15 ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)"}`,
                        }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: getCatColor(cat) }} />
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{cat}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                            color: change > 15 ? "#F87171" : change < -15 ? accent : "rgba(255,255,255,0.4)",
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
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#8B5CF6", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>Modelo de Regresion Lineal</p>
                    <div style={{ display: "flex", gap: 20 }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>
                        Pendiente: {fmt(Math.round(forecastData.regression.slope))}/mes
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>
                        R² = {Math.round(forecastData.regression.r2 * 100)}%
                      </span>
                      <span style={{ fontSize: 11, color: forecastData.regression.r2 > 0.7 ? accent : forecastData.regression.r2 > 0.4 ? "#F59E0B" : "#EF4444", fontFamily: "'DM Mono', monospace" }}>
                        Ajuste: {forecastData.regression.r2 > 0.7 ? "Bueno" : forecastData.regression.r2 > 0.4 ? "Moderado" : "Bajo"}
                      </span>
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: 16 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#EF4444", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>Alertas</p>
                    {forecastData.alertas?.map((a, i) => (
                      <p key={i} style={{ margin: "0 0 6px", fontSize: 12, color: "#FCA5A5", paddingLeft: 12, borderLeft: "2px solid rgba(239,68,68,0.4)" }}>- {a}</p>
                    ))}
                  </div>
                  <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: 16 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>Recomendaciones</p>
                    {forecastData.recomendaciones?.map((r, i) => (
                      <p key={i} style={{ margin: "0 0 6px", fontSize: 12, color: "#D1FAE5", paddingLeft: 12, borderLeft: "2px solid rgba(16,185,129,0.4)" }}>- {r}</p>
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
                  Regenerar proyeccion
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
                <button onClick={generateForecast} style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 8, padding: "10px 24px", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, color: "#FCA5A5",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  Reintentar
                </button>
              </div>
            )}
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: "rgba(255,255,255,0.1)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>
          FINANCEAI · DETECCION ESTADISTICA DE ANOMALIAS · REGRESION LINEAL · IMPORTACION DE DATOS
        </p>
      </div>
    </div>
    <ContactBar />
    </>
  );
}
