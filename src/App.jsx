import { useState, useEffect, useRef, useMemo, useCallback } from "react";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, ReferenceLine, Legend } from 'recharts';

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

// ─── RECHARTS CUSTOM TOOLTIPS ────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label, valuePrefix = "" }) => {
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
};

const PieTooltip = ({ active, payload }) => {
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
};

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
function AnomalyRow({ tx, onAnalyze, isHighlighted, rowRef, t: rowT }) {
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
      <button onClick={(e) => { e.stopPropagation(); onAnalyze(tx); }} style={{
        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
        borderRadius: 6, padding: "5px 10px", cursor: "pointer",
        fontSize: 11, color: "#FCA5A5", fontFamily: "sans-serif",
        transition: "all 0.15s",
      }}>
        {rowT?.analizarIA || 'Analizar IA'}
      </button>
    </div>
  );
}

// ─── DATA IMPORT PANEL ──────────────────────────────────────────────────────
function ImportPanel({ onImport, t: parentT }) {
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
          {parentT.importarCSV}
        </button>
        <button onClick={() => setMode("paste")} style={{
          background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)",
          borderRadius: 8, padding: "7px 14px", cursor: "pointer",
          fontSize: 11, fontWeight: 600, color: "#8B5CF6", fontFamily: "'DM Sans', sans-serif",
        }}>
          {parentT.pegarDatos}
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
          {mode === "csv" ? parentT.importarArchivoCSV : parentT.pegarDatos}
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
        <p style={{ margin: "0 0 4px", fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 700 }}>{parentT.formatoEsperado}</p>
        fecha,categoria,monto,descripcion<br/>
        2025-01-15,Marketing,8500,Campana Google Ads<br/>
        2025-01-16,Software,3200,Licencia Figma<br/>
        2025-01-17,Nomina,45000,Pago quincenal<br/>
        <p style={{ margin: "8px 0 0", fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
          {parentT.columnasMinimas}
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
            {parentT.seleccionarArchivo}
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
            {parentT.procesarDatos}
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
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#F59E0B" }}>{parentT.advertencias} ({importResult.errors.length}):</p>
              {importResult.errors.slice(0, 5).map((err, i) => (
                <p key={i} style={{ margin: 0, fontSize: 10, color: "rgba(245,158,11,0.7)", fontFamily: "'DM Mono', monospace" }}>- {err}</p>
              ))}
              {importResult.errors.length > 5 && (
                <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>...+{importResult.errors.length - 5} {parentT.yMas}</p>
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
                {parentT.confirmarImportacion}
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
// ─── FINANCE CHATBOT ─────────────────────────────────────────────────────────
function FinanceChatbot({ metrics, transactions, anomalies, forecastData, activeTab, onNavigate, lang, t: chatT, onExposeControls }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesRef = useRef(null);
  const hoverTimer = useRef(null);

  const scroll = () => setTimeout(() => messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" }), 50);

  // ─── CLAUDE TOOL USE ───────────────────────────────────────────────────
  const FINANCE_TOOLS = useMemo(() => [
    {
      name: "detect_anomalies",
      description: "Detect anomalous transactions using z-score statistical analysis. Returns transactions that deviate >2 standard deviations from their category mean.",
      input_schema: {
        type: "object",
        properties: {
          category: { type: "string", description: "Filter by category (optional). Options: Marketing, Nomina, Software, Infraestructura, Logistica, Ventas, Operaciones" },
          risk_level: { type: "string", enum: ["all", "high", "medium", "low"], description: "Filter by risk level" }
        }
      }
    },
    {
      name: "get_spending_summary",
      description: "Get spending summary with totals by category, monthly trends, and averages.",
      input_schema: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["all", "last_month", "last_3_months"], description: "Time period" }
        }
      }
    },
    {
      name: "forecast_cashflow",
      description: "Generate cash flow projection using linear regression on monthly spending data. Returns projected amount, trend, R-squared confidence, and recommendations.",
      input_schema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "analyze_category",
      description: "Deep analysis of a specific spending category: mean, std deviation, trend, anomaly count, month-over-month growth.",
      input_schema: {
        type: "object",
        properties: {
          category: { type: "string", description: "Category name to analyze" }
        },
        required: ["category"]
      }
    },
    {
      name: "compare_periods",
      description: "Compare spending between two months or periods.",
      input_schema: {
        type: "object",
        properties: {
          metric: { type: "string", enum: ["total", "anomalies", "by_category"], description: "What to compare" }
        }
      }
    }
  ], []);

  const executeToolCall = useCallback((toolName, toolInput) => {
    try {
      switch (toolName) {
        case "detect_anomalies": {
          let filtered = [...anomalies];
          if (toolInput.category) {
            filtered = filtered.filter(a => a.categoria?.toLowerCase() === toolInput.category.toLowerCase() || a.category?.toLowerCase() === toolInput.category.toLowerCase());
          }
          if (toolInput.risk_level && toolInput.risk_level !== "all") {
            const thresholds = { high: 70, medium: 40, low: 0 };
            filtered = filtered.filter(a => {
              const score = a.riskScore ?? a.score ?? 0;
              if (toolInput.risk_level === "high") return score >= 70;
              if (toolInput.risk_level === "medium") return score >= 40 && score < 70;
              return score < 40;
            });
          }
          const top3 = filtered.slice(0, 3).map(a => ({
            description: a.descripcion || a.description || "N/A",
            category: a.categoria || a.category || "N/A",
            amount: a.monto || a.amount || 0,
            riskScore: a.riskScore ?? a.score ?? 0,
            date: a.fecha || a.date || "N/A",
          }));
          return { total_anomalies: filtered.length, top_3: top3, total_in_dataset: anomalies.length };
        }
        case "get_spending_summary": {
          const monthlyEntries = Object.entries(metrics.monthly || {}).sort((a, b) => a[0].localeCompare(b[0]));
          let filteredMonths = monthlyEntries;
          if (toolInput.period === "last_month" && monthlyEntries.length > 0) {
            filteredMonths = monthlyEntries.slice(-1);
          } else if (toolInput.period === "last_3_months" && monthlyEntries.length > 0) {
            filteredMonths = monthlyEntries.slice(-3);
          }
          const periodTotal = filteredMonths.reduce((s, [, v]) => s + v, 0);
          return {
            total: metrics.total,
            period_total: periodTotal,
            months_count: filteredMonths.length,
            by_category: metrics.byCategory || {},
            monthly_trend: Object.fromEntries(filteredMonths),
            average_monthly: filteredMonths.length > 0 ? Math.round(periodTotal / filteredMonths.length) : 0,
            total_transactions: transactions.length,
          };
        }
        case "forecast_cashflow": {
          if (forecastData && !forecastData.error) {
            return {
              projected_next_month: forecastData.proyeccion_mes,
              trend: forecastData.tendencia,
              expected_variation_pct: forecastData.variacion_esperada,
              r_squared: forecastData.regression?.r2,
              slope: forecastData.regression?.slope,
              intercept: forecastData.regression?.intercept,
              alerts: forecastData.alertas || [],
              recommendations: forecastData.recomendaciones || [],
            };
          }
          const monthlyEntries = Object.entries(metrics.monthly || {}).sort((a, b) => a[0].localeCompare(b[0]));
          const ys = monthlyEntries.map(([, v]) => v);
          const xs = ys.map((_, i) => i + 1);
          if (xs.length < 2) return { error: "Not enough data for forecast (need at least 2 months)" };
          const reg = linearRegression(xs, ys);
          const projected = Math.round(reg.slope * (xs.length + 1) + reg.intercept);
          const lastMonth = ys[ys.length - 1] || 0;
          const variation = lastMonth > 0 ? Math.round(((projected - lastMonth) / lastMonth) * 100) : 0;
          return {
            projected_next_month: projected,
            trend: reg.slope > 0 ? "upward" : reg.slope < 0 ? "downward" : "stable",
            expected_variation_pct: variation,
            r_squared: Math.round(reg.r2 * 100) / 100,
          };
        }
        case "analyze_category": {
          const cat = toolInput.category;
          const catTx = transactions.filter(t => (t.categoria || t.category || "").toLowerCase() === cat.toLowerCase());
          const amounts = catTx.map(t => t.monto || t.amount || 0);
          const mean = amounts.length > 0 ? amounts.reduce((s, v) => s + v, 0) / amounts.length : 0;
          const std = amounts.length > 1 ? Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / (amounts.length - 1)) : 0;
          const catAnomalies = anomalies.filter(a => (a.categoria || a.category || "").toLowerCase() === cat.toLowerCase());
          // month-over-month
          const byMonth = {};
          catTx.forEach(t => {
            const m = (t.fecha || t.date || "").substring(0, 7);
            if (m) byMonth[m] = (byMonth[m] || 0) + (t.monto || t.amount || 0);
          });
          const monthKeys = Object.keys(byMonth).sort();
          let growth = null;
          if (monthKeys.length >= 2) {
            const last = byMonth[monthKeys[monthKeys.length - 1]];
            const prev = byMonth[monthKeys[monthKeys.length - 2]];
            growth = prev > 0 ? Math.round(((last - prev) / prev) * 100) : null;
          }
          return {
            category: cat,
            transaction_count: catTx.length,
            total: Math.round(amounts.reduce((s, v) => s + v, 0)),
            mean: Math.round(mean),
            std_deviation: Math.round(std),
            anomaly_count: catAnomalies.length,
            month_over_month_growth_pct: growth,
            monthly_breakdown: byMonth,
          };
        }
        case "compare_periods": {
          const monthlyEntries = Object.entries(metrics.monthly || {}).sort((a, b) => a[0].localeCompare(b[0]));
          if (monthlyEntries.length < 2) return { error: "Need at least 2 months to compare" };
          const [prevKey, prevVal] = monthlyEntries[monthlyEntries.length - 2];
          const [lastKey, lastVal] = monthlyEntries[monthlyEntries.length - 1];
          const result = { period_1: { month: prevKey, total: prevVal }, period_2: { month: lastKey, total: lastVal }, change_pct: prevVal > 0 ? Math.round(((lastVal - prevVal) / prevVal) * 100) : 0 };
          if (toolInput.metric === "by_category") {
            const catByMonth = (month) => {
              const cats = {};
              transactions.filter(t => (t.fecha || t.date || "").startsWith(month)).forEach(t => {
                const c = t.categoria || t.category || "Other";
                cats[c] = (cats[c] || 0) + (t.monto || t.amount || 0);
              });
              return cats;
            };
            result.period_1.by_category = catByMonth(prevKey);
            result.period_2.by_category = catByMonth(lastKey);
          }
          if (toolInput.metric === "anomalies") {
            result.period_1.anomaly_count = anomalies.filter(a => (a.fecha || a.date || "").startsWith(prevKey)).length;
            result.period_2.anomaly_count = anomalies.filter(a => (a.fecha || a.date || "").startsWith(lastKey)).length;
          }
          return result;
        }
        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    } catch (err) {
      return { error: err.message };
    }
  }, [anomalies, metrics, transactions, forecastData]);

  const callClaudeWithTools = useCallback(async (userText) => {
    const isEN = lang === 'en';
    const totalTx = transactions.length;
    const anomalyCount = anomalies.length;
    const months = Object.keys(metrics.monthly || {}).length;
    const topCat = Object.entries(metrics.byCategory || {}).sort((a, b) => b[1] - a[1]);

    const systemPrompt = `You are FinanceAI, an intelligent financial assistant embedded in a dashboard. ${isEN ? 'Respond in English.' : 'Respond in Spanish.'}

Current dashboard context:
- Total spending: ${fmt(metrics.total)}
- Transactions: ${totalTx}
- Anomalies detected: ${anomalyCount}
- Months of data: ${months}
- Top categories: ${topCat.slice(0, 5).map(([c, v]) => `${c}: ${fmt(v)}`).join(', ')}
- Monthly trend: ${Object.entries(metrics.monthly || {}).sort((a, b) => a[0].localeCompare(b[0])).map(([m, v]) => `${m}: ${fmt(v)}`).join(', ')}

Use tools to answer data questions with precision. Format responses in markdown with **bold** for key figures. Keep answers concise but insightful.`;

    const conversationMessages = [{ role: "user", content: userText }];

    const apiBase = window.location.hostname === 'localhost' ? '/api/chat' : '/api/chat';

    // Agentic loop: keep calling until we get a text response
    let maxIterations = 5;
    while (maxIterations-- > 0) {
      const response = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          tools: FINANCE_TOOLS,
          messages: conversationMessages,
        }),
      });

      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || data.error);

      // Process response blocks
      const textParts = [];
      const toolUses = [];
      for (const block of data.content || []) {
        if (block.type === "text") textParts.push(block.text);
        if (block.type === "tool_use") toolUses.push(block);
      }

      // If there are tool calls, execute them and continue loop
      if (toolUses.length > 0) {
        // Add assistant message to conversation
        conversationMessages.push({ role: "assistant", content: data.content });

        // Execute each tool and add results
        const toolResults = toolUses.map(tu => ({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(executeToolCall(tu.name, tu.input)),
        }));
        conversationMessages.push({ role: "user", content: toolResults });

        // If stop_reason is end_turn with text, we're done
        if (data.stop_reason === "end_turn" && textParts.length > 0) {
          return textParts.join("\n\n");
        }
        continue; // Loop back for Claude's final response
      }

      // No tool calls — return text
      if (textParts.length > 0) return textParts.join("\n\n");
      throw new Error("Empty response");
    }
    throw new Error("Max iterations reached");
  }, [lang, metrics, transactions, anomalies, FINANCE_TOOLS, executeToolCall]);

  const addBot = useCallback((text) => {
    setMessages(prev => [...prev, { role: "bot", text }]);
    scroll();
  }, []);

  const KB = useMemo(() => {
    const totalTx = transactions.length;
    const anomalyCount = anomalies.length;
    const anomalyPct = totalTx > 0 ? Math.round((anomalyCount / totalTx) * 100) : 0;
    const months = Object.keys(metrics.monthly).length;
    const topCat = Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1]);
    const avgMonthly = metrics.total / Math.max(months, 1);

    const isEN = lang === 'en';

    return {
      overview: {
        keys: ["overview", "resumen", "general", "inicio", "dashboard", "que veo", "que es esto", "explicar", "ayuda", "help", "hola", "buenas", "what is this", "what"],
        response: isEN
          ? `This is **FinanceAI**, an intelligent financial analysis dashboard. It has 4 sections:\n\n- **Overview** — Main KPIs: total spending (${fmt(metrics.total)}), anomalies (${anomalyCount}), monthly average (${fmt(Math.round(avgMonthly))}), and trend + category charts.\n\n- **Anomalies** — Transactions flagged as outliers using statistical z-score (threshold: 2 standard deviations). You can analyze each one in detail.\n\n- **Transactions** — Full table with search and category filters.\n\n- **Projection** — Forecast based on linear regression with alerts and recommendations.\n\nAsk me about any section or concept.`
          : `Este es **FinanceAI**, un dashboard de analisis financiero inteligente. Tienes 4 secciones:\n\n• **Overview** — KPIs principales: gasto total (${fmt(metrics.total)}), anomalias (${anomalyCount}), promedio mensual (${fmt(Math.round(avgMonthly))}), y graficas de tendencia + distribucion por categoria.\n\n• **Anomalias** — Transacciones detectadas como atipicas usando z-score estadistico (umbral: 2 desviaciones estandar). Puedes analizar cada una en detalle.\n\n• **Transacciones** — Tabla completa con busqueda y filtros por categoria.\n\n• **Proyeccion** — Forecast basado en regresion lineal con alertas y recomendaciones.\n\nPreguntame sobre cualquier seccion o concepto.`,
      },
      anomalias: {
        keys: ["anomalia", "anomalias", "atipic", "riesgo", "fraude", "sospech", "alerta", "z-score", "zscore", "desviacion", "sigma", "anomaly", "anomalies", "risk", "fraud", "outlier"],
        response: isEN
          ? `**${anomalyCount} anomalies** detected (${anomalyPct}% of ${totalTx} transactions).\n\n**How detection works:**\n1. Mean and standard deviation are calculated per category\n2. If a transaction is more than **2 standard deviations** from the mean, it's flagged\n3. Risk score (0-100%) is based on distance from mean (normalized to 5 sigma)\n\n**Risk levels:**\n- **High (>70%)** — Immediate action required\n- **Medium (40-70%)** — Monitor closely\n- **Low (<40%)** — Document for review\n\nClick any anomaly to see detailed analysis with diagnosis, causes and recommendations.${activeTab !== "anomalias" ? "\n\nWant to go to the Anomalies section?" : ""}`
          : `Se detectaron **${anomalyCount} anomalias** (${anomalyPct}% del total de ${totalTx} transacciones).\n\n**Como funciona la deteccion:**\n1. Se calcula la media y desviacion estandar por categoria\n2. Si una transaccion esta a mas de **2 desviaciones estandar** de la media, se marca como anomalia\n3. El score de riesgo (0-100%) se basa en que tan lejos esta de la media (normalizado a 5 sigma)\n\n**Niveles de riesgo:**\n• **Alto (>70%)** — Accion inmediata requerida\n• **Medio (40-70%)** — Monitorear de cerca\n• **Bajo (<40%)** — Documentar para revision\n\nHaz click en cualquier anomalia para ver el analisis detallado con diagnostico, causas y recomendaciones.${activeTab !== "anomalias" ? "\n\n¿Quieres ir a la seccion de anomalias?" : ""}`,
      },
      transacciones: {
        keys: ["transaccion", "transacciones", "tabla", "buscar", "filtrar", "movimiento", "gasto", "pago", "transaction", "transactions", "table", "search", "filter"],
        response: isEN
          ? `There are **${totalTx} transactions** over a ${months}-month period.\n\n**Features:**\n- **Search** — Type any text to filter by description or category\n- **Category filter** — Select a specific category\n- Anomalous transactions are highlighted in **red**\n\n**Available categories:** ${topCat.map(([c, v]) => `${c} (${fmt(v)})`).join(", ")}${activeTab !== "transacciones" ? "\n\nWant to go to the Transactions section?" : ""}`
          : `Hay **${totalTx} transacciones** en el periodo de ${months} meses.\n\n**Funcionalidades:**\n• **Busqueda** — Escribe cualquier texto para filtrar por descripcion o categoria\n• **Filtro por categoria** — Selecciona una categoria especifica\n• Las transacciones anomalas se resaltan en **rojo**\n\n**Categorias disponibles:** ${topCat.map(([c, v]) => `${c} (${fmt(v)})`).join(", ")}${activeTab !== "transacciones" ? "\n\n¿Quieres ir a la seccion de transacciones?" : ""}`,
      },
      proyeccion: {
        keys: ["proyeccion", "forecast", "prediccion", "futuro", "proximo mes", "regresion", "tendencia", "r2", "lineal", "projection", "prediction", "next month", "trend"],
        response: forecastData && !forecastData.error
          ? (isEN
            ? `**Projection generated:**\n- Next month: **${fmt(forecastData.proyeccion_mes)}**\n- Trend: **${forecastData.tendencia}**\n- Expected variation: **${forecastData.variacion_esperada > 0 ? "+" : ""}${forecastData.variacion_esperada}%**\n- Model R²: **${Math.round(forecastData.regression?.r2 * 100)}%** (${forecastData.regression?.r2 > 0.7 ? "good fit" : forecastData.regression?.r2 > 0.4 ? "moderate fit" : "low fit"})\n\n**How it works:**\nLinear regression is applied to monthly totals. The model fits a line (y = slope x month + intercept) and extends it. R² indicates how well the line fits the data.\n\nAlerts and recommendations are auto-generated by analyzing category trends, spending concentration and anomaly rate.`
            : `**Proyeccion generada:**\n• Proximo mes: **${fmt(forecastData.proyeccion_mes)}**\n• Tendencia: **${forecastData.tendencia}**\n• Variacion esperada: **${forecastData.variacion_esperada > 0 ? "+" : ""}${forecastData.variacion_esperada}%**\n• R² del modelo: **${Math.round(forecastData.regression?.r2 * 100)}%** (${forecastData.regression?.r2 > 0.7 ? "buen ajuste" : forecastData.regression?.r2 > 0.4 ? "ajuste moderado" : "ajuste bajo"})\n\n**Como funciona:**\nSe aplica regresion lineal sobre los totales mensuales. El modelo calcula una recta (y = pendiente × mes + intercepto) y la extiende al siguiente mes. El R² indica que tan bien se ajusta la recta a los datos.\n\nLas alertas y recomendaciones se generan automaticamente analizando tendencias por categoria, concentracion de gasto y tasa de anomalias.`)
          : (isEN
            ? `The projection uses **linear regression** on monthly data to predict next month's spending.\n\n**Methodology:**\n1. Transactions are grouped by month\n2. A line is fitted using least squares\n3. R² is calculated to measure reliability\n4. Alerts are generated based on: category growth, spending concentration, and anomaly rate\n\nGo to the "Projection" section and click "Generate Projection" to see it in action.${activeTab !== "proyeccion" ? "\n\nWant to go to the Projection section?" : ""}`
            : `La proyeccion usa **regresion lineal** sobre los datos mensuales para predecir el gasto del proximo mes.\n\n**Metodologia:**\n1. Se agrupan las transacciones por mes\n2. Se ajusta una recta con minimos cuadrados\n3. Se calcula R² para medir la confiabilidad\n4. Se generan alertas basadas en: crecimiento por categoria, concentracion de gasto, y tasa de anomalias\n\nVe a la seccion "Proyeccion" y haz click en "Generar Proyeccion" para verlo en accion.${activeTab !== "proyeccion" ? "\n\n¿Quieres ir a la seccion de proyeccion?" : ""}`),
      },
      categorias: {
        keys: ["categoria", "categorias", "distribucion", "pie", "donut", "desglose", "marketing", "nomina", "software", "infraestructura", "logistica", "ventas", "operaciones", "category", "categories", "distribution", "breakdown"],
        response: isEN
          ? `**Category distribution:**\n${topCat.map(([c, v]) => `- **${c}**: ${fmt(v)} (${Math.round(v / metrics.total * 100)}%)`).join("\n")}\n\nThe donut chart shows this distribution visually. Each category has its own color — hover to see exact amounts.\n\nThe most concentrated category is **${topCat[0]?.[0]}** at ${Math.round((topCat[0]?.[1] || 0) / metrics.total * 100)}% of total spending.`
          : `**Distribucion por categoria:**\n${topCat.map(([c, v]) => `• **${c}**: ${fmt(v)} (${Math.round(v / metrics.total * 100)}%)`).join("\n")}\n\nLa grafica de dona muestra esta distribucion visualmente. Cada categoria tiene su propio color y puedes pasar el cursor sobre cada seccion para ver el monto exacto.\n\nLa categoria con mayor concentracion es **${topCat[0]?.[0]}** con ${Math.round((topCat[0]?.[1] || 0) / metrics.total * 100)}% del gasto total.`,
      },
      importar: {
        keys: ["importar", "csv", "datos", "cargar", "subir", "archivo", "pegar", "excel", "propio", "import", "upload", "data", "file", "paste"],
        response: isEN
          ? `You can import your own data in two ways:\n\n**1. CSV file** — Upload a .csv, .tsv or .txt file\n**2. Paste data** — Copy and paste directly from Excel or Google Sheets\n\n**Required format:**\n\`\`\`\ndate,category,amount,description\n2025-01-15,Marketing,8500,Google Ads Campaign\n\`\`\`\n\n**Minimum columns:** date + amount\n**Date formats:** YYYY-MM-DD, DD/MM/YYYY\n**Separators:** comma, tab, semicolon\n\nWhen you import, the system automatically recalculates all anomalies, metrics and projections with your real data.\n\nLook for the **"Import CSV"** or **"Paste data"** buttons in the top bar.`
          : `Puedes importar tus propios datos de dos formas:\n\n**1. Archivo CSV** — Sube un archivo .csv, .tsv o .txt\n**2. Pegar datos** — Copia y pega directamente desde Excel o Google Sheets\n\n**Formato requerido:**\n\`\`\`\nfecha,categoria,monto,descripcion\n2025-01-15,Marketing,8500,Campana Google Ads\n\`\`\`\n\n**Columnas minimas:** fecha + monto\n**Formatos de fecha:** YYYY-MM-DD, DD/MM/YYYY\n**Separadores:** coma, tab, punto y coma\n\nAl importar, el sistema recalcula automaticamente todas las anomalias, metricas y proyecciones con tus datos reales.\n\nBusca los botones **"Importar CSV"** o **"Pegar datos"** en la barra superior.`,
      },
      kpi: {
        keys: ["kpi", "indicador", "metrica", "tarjeta", "card", "total", "promedio", "gasto total", "metric", "average", "spending"],
        response: isEN
          ? `**Main KPIs:**\n\n- **Total Spending**: ${fmt(metrics.total)} — Sum of all transactions in the period\n- **Anomalies Detected**: ${anomalyCount} (${anomalyPct}%) — Transactions exceeding 2 standard deviations\n- **Top Category**: ${topCat[0]?.[0]} (${fmt(topCat[0]?.[1] || 0)}) — Where most spending is concentrated\n- **Monthly Average**: ${fmt(Math.round(avgMonthly))} — Total divided by ${months} months\n\nThe sparklines below each KPI show the monthly trend. Hover over them for exact values.`
          : `**KPIs principales:**\n\n• **Gasto Total**: ${fmt(metrics.total)} — Suma de todas las transacciones en el periodo\n• **Anomalias Detectadas**: ${anomalyCount} (${anomalyPct}%) — Transacciones que superan 2 desviaciones estandar\n• **Mayor Categoria**: ${topCat[0]?.[0]} (${fmt(topCat[0]?.[1] || 0)}) — Donde se concentra mas gasto\n• **Promedio Mensual**: ${fmt(Math.round(avgMonthly))} — Total dividido entre ${months} meses\n\nLas minilineas (sparklines) debajo de cada KPI muestran la tendencia mensual. Pasa el cursor sobre ellas para ver valores exactos.`,
      },
      graficas: {
        keys: ["grafica", "grafico", "chart", "area", "linea", "barra", "visualiz", "graph", "visualization"],
        response: isEN
          ? `The dashboard has 4 chart types:\n\n- **Area Chart (Overview)** — Shows monthly spending as a shaded area. The shape reveals trends: rises, drops or stability.\n\n- **Donut Chart (Overview)** — Spending proportion by category. Hover to see exact amounts.\n\n- **Risk Distribution (Anomalies)** — Horizontal bars showing how many anomalies exist per risk level (High/Medium/Low).\n\n- **Forecast Chart (Projection)** — Solid green line (historical) + dashed purple line (projection). Includes average reference line.\n\nAll charts are interactive — hover to see detailed tooltips.`
          : `El dashboard tiene 4 tipos de graficas:\n\n• **Area Chart (Overview)** — Muestra el gasto mensual como area sombreada. La forma revela tendencias: subidas, bajadas o estabilidad.\n\n• **Donut Chart (Overview)** — Proporcion del gasto por categoria. Pasa el cursor para ver montos exactos.\n\n• **Risk Distribution (Anomalias)** — Barras horizontales mostrando cuantas anomalias hay por nivel de riesgo (Alto/Medio/Bajo).\n\n• **Forecast Chart (Proyeccion)** — Linea verde solida (datos historicos) + linea morada punteada (proyeccion). Incluye linea de referencia del promedio.\n\nTodas las graficas son interactivas — pasa el cursor para ver tooltips con datos detallados.`,
      },
      metodologia: {
        keys: ["metodologia", "como funciona", "explicar", "tecnico", "estadistic", "modelo", "algoritmo", "ciencia", "methodology", "how does it work", "technical", "model", "algorithm"],
        response: isEN
          ? `**Dashboard methodology:**\n\n**1. Anomaly detection (z-score):**\n- For each category: mean (\u03BC) and standard deviation (\u03C3)\n- Anomaly if |amount - \u03BC| / \u03C3 > 2\n- Normalized score: distance / 5\u03C3 x 100%\n\n**2. Linear regression (forecast):**\n- Variables: X = month index, Y = monthly spending\n- Minimizes the sum of squared errors\n- R\u00B2 measures goodness of fit (0-100%)\n- Projection: Y_next = slope x (N+1) + intercept\n\n**3. Automatic alerts:**\n- Categories with >25% monthly growth\n- Spending concentration >30% in one category\n- Anomaly rate >3% of total\n- High variability (coefficient of variation >20%)`
          : `**Metodologia del dashboard:**\n\n**1. Deteccion de anomalias (z-score):**\n- Para cada categoria: media (\u03BC) y desviacion estandar (\u03C3)\n- Anomalia si |monto - \u03BC| / \u03C3 > 2\n- Score normalizado: distancia / 5\u03C3 \u00D7 100%\n\n**2. Regresion lineal (forecast):**\n- Variables: X = indice del mes, Y = gasto mensual\n- Minimiza la suma de errores cuadraticos\n- R\u00B2 mide la bondad de ajuste (0-100%)\n- Proyeccion: Y_siguiente = pendiente \u00D7 (N+1) + intercepto\n\n**3. Alertas automaticas:**\n- Categorias con crecimiento >25% mensual\n- Concentracion de gasto >30% en una categoria\n- Tasa de anomalias >3% del total\n- Alta variabilidad (coeficiente de variacion >20%)`,
      },
    };
  }, [metrics, transactions, anomalies, forecastData, activeTab, lang]);

  const quickActions = [
    { label: chatT.queEsEsto, query: "que es esto" },
    { label: chatT.anomalias, query: "anomalias" },
    { label: chatT.proyeccion, query: "proyeccion" },
    { label: chatT.importarDatos, query: "importar" },
    { label: chatT.metodologia, query: "metodologia" },
  ];

  const matchIntent = useCallback((text) => {
    const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let bestMatch = null;
    let bestScore = 0;

    for (const [, entry] of Object.entries(KB)) {
      let score = 0;
      for (const key of entry.keys) {
        const nKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalized.includes(nKey)) score++;
      }
      if (score > bestScore) { bestScore = score; bestMatch = entry; }
    }

    if (bestMatch && bestScore > 0) return bestMatch.response;

    // Navigation intents
    if (/ir a|llevar|mostrar|abrir|go to|show|open/.test(normalized)) {
      if (/anomal/.test(normalized)) { onNavigate("anomalias"); return lang === 'en' ? "Done, I took you to the **Anomalies** section." : "Listo, te lleve a la seccion de **Anomalias**."; }
      if (/transac/.test(normalized)) { onNavigate("transacciones"); return lang === 'en' ? "Done, I took you to the **Transactions** section." : "Listo, te lleve a la seccion de **Transacciones**."; }
      if (/proyec|forecast|project/.test(normalized)) { onNavigate("proyeccion"); return lang === 'en' ? "Done, I took you to the **Projection** section." : "Listo, te lleve a la seccion de **Proyeccion**."; }
      if (/overview|inicio|resumen|home/.test(normalized)) { onNavigate("overview"); return lang === 'en' ? "Done, I took you to the **Overview**." : "Listo, te lleve al **Overview**."; }
    }

    return lang === 'en'
      ? "I can help you with:\n\n- **Dashboard** — What each section shows\n- **Anomalies** — How they are detected and what they mean\n- **Projection** — How the forecast works\n- **Categories** — Spending distribution\n- **Import data** — How to upload your own CSV\n- **Charts** — What each visualization represents\n- **Methodology** — Technical model explanation\n\nI can also navigate: say **\"go to anomalies\"** or **\"go to projection\"**."
      : "Puedo ayudarte con:\n\n• **Dashboard** — Que muestra cada seccion\n• **Anomalias** — Como se detectan y que significan\n• **Proyeccion** — Como funciona el forecast\n• **Categorias** — Distribucion del gasto\n• **Importar datos** — Como subir tu propio CSV\n• **Graficas** — Que representa cada visualizacion\n• **Metodologia** — Explicacion tecnica del modelo\n\nTambien puedo navegar: di **\"ir a anomalias\"** o **\"ir a proyeccion\"**.";
  }, [KB, onNavigate]);

  const handleSend = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setMessages(prev => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setIsPinned(true);
    setIsLoading(true);
    scroll();

    try {
      const response = await callClaudeWithTools(trimmed);
      setMessages(prev => [...prev, { role: "bot", text: response, source: "ai" }]);
    } catch {
      // Fallback to local KB
      const response = matchIntent(trimmed);
      setMessages(prev => [...prev, { role: "bot", text: response, source: "local" }]);
    } finally {
      setIsLoading(false);
      scroll();
    }
  }, [matchIntent, callClaudeWithTools, isLoading]);

  const open = () => {
    if (isOpen) return;
    setIsOpen(true);
    if (messages.length === 0) {
      setTimeout(() => addBot(chatT.chatGreeting), 200);
    }
  };

  const close = () => { setIsOpen(false); setIsPinned(false); };

  const fmtMsg = (text) => text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-size:11px">$1</code>')
    .replace(/\n/g, "<br/>");

  // Expose open/send for tour
  useEffect(() => {
    if (typeof onExposeControls === 'function') {
      onExposeControls({ open: () => { setIsPinned(true); open(); }, send: handleSend });
    }
  }, [handleSend]);

  return (
    <div
      data-tour="chatbot"
      style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9998, fontFamily: "'DM Sans', sans-serif" }}
      onMouseEnter={() => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(open, 300); }}
      onMouseLeave={() => { clearTimeout(hoverTimer.current); if (!isPinned) hoverTimer.current = setTimeout(close, 600); }}
    >
      {/* FAB */}
      <button onClick={() => { if (isOpen) close(); else { setIsPinned(true); open(); } }} style={{
        width: 52, height: 52, borderRadius: "50%", border: "none",
        background: "linear-gradient(135deg, #10B981, #059669)",
        color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px rgba(16,185,129,0.35)", transition: "transform 0.2s",
        position: "relative", zIndex: 2,
      }}>
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        )}
      </button>

      {/* Panel */}
      <div style={{
        position: "absolute", bottom: 64, right: 0, width: 380,
        maxHeight: isOpen ? 540 : 0, overflow: "hidden",
        background: "#0D1117", border: "1px solid rgba(16,185,129,0.2)",
        borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        display: "flex", flexDirection: "column",
        opacity: isOpen ? 1 : 0, transform: isOpen ? "translateY(0)" : "translateY(12px)",
        transition: "max-height 0.35s ease, opacity 0.25s ease, transform 0.25s ease",
        pointerEvents: isOpen ? "auto" : "none",
      }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))", padding: "14px 18px", borderBottom: "1px solid rgba(16,185,129,0.15)", flexShrink: 0 }}>
          <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "#10B981" }}>{chatT.asistente}</span>
          <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{chatT.teExplico}</span>
        </div>

        {/* Messages */}
        <div ref={messagesRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, minHeight: 80 }}
          onClick={() => setIsPinned(true)}>
          {messages.map((msg, i) => (
            <div key={i} style={{ maxWidth: "88%", alignSelf: msg.role === "bot" ? "flex-start" : "flex-end" }}>
              <div style={{
                padding: "10px 14px", borderRadius: 12, fontSize: 12, lineHeight: 1.55,
                ...(msg.role === "bot"
                  ? { background: "rgba(255,255,255,0.04)", color: "#D1D5DB", borderBottomLeftRadius: 4 }
                  : { background: "rgba(16,185,129,0.15)", color: "#A7F3D0", borderBottomRightRadius: 4 }),
              }} dangerouslySetInnerHTML={{ __html: fmtMsg(msg.text) }} />
              {msg.role === "bot" && msg.source && (
                <span style={{
                  display: "inline-block", marginTop: 3, padding: "1px 6px", borderRadius: 4, fontSize: 9,
                  fontWeight: 600, letterSpacing: 0.5,
                  background: msg.source === "ai" ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.06)",
                  color: msg.source === "ai" ? "#818CF8" : "rgba(255,255,255,0.3)",
                  border: `1px solid ${msg.source === "ai" ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.08)"}`,
                }}>{msg.source === "ai" ? "AI" : "Local"}</span>
              )}
            </div>
          ))}
          {isLoading && (
            <div style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", fontSize: 12, color: "#6B7280" }}>
              <span style={{ animation: "pulseDots 1.4s infinite" }}>{"..."}</span>
              <style>{`@keyframes pulseDots { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }`}</style>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "6px 14px 8px", flexShrink: 0 }}>
          {quickActions.map(qa => (
            <button key={qa.label} onClick={() => handleSend(qa.query)} style={{
              background: "transparent", border: "1px solid rgba(16,185,129,0.2)", color: "#10B981",
              padding: "4px 10px", borderRadius: 14, fontSize: 10, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.target.style.background = "rgba(16,185,129,0.15)"; }}
            onMouseLeave={e => { e.target.style.background = "transparent"; }}
            >{qa.label}</button>
          ))}
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 6, padding: "8px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSend(input); }}
            onFocus={() => setIsPinned(true)}
            placeholder={chatT.preguntaSobre}
            style={{
              flex: 1, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px",
              background: "rgba(255,255,255,0.04)", color: "#F1F5F9", fontSize: 12,
              fontFamily: "'DM Sans', sans-serif", outline: "none",
            }} />
          <button onClick={() => handleSend(input)} style={{
            width: 36, height: 36, border: "none", borderRadius: 8,
            background: "linear-gradient(135deg, #10B981, #059669)", color: "#fff",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactBar({ lang }) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem('cta-dismissed')) return;
    const timer = setTimeout(() => setShow(true), 10000);
    return () => clearTimeout(timer);
  }, []);
  if (dismissed || !show) return null;
  const dismiss = () => { setDismissed(true); sessionStorage.setItem('cta-dismissed', '1'); };
  const isEN = lang === 'en';
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(99,102,241,0.2)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', animation: 'slideUpCTA 0.4s ease', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes slideUpCTA { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <span style={{ color: '#E2E8F0', fontSize: 14, fontWeight: 500 }}>{isEN ? "This is a free demo by Impulso IA. Want something like this for your business?" : "Esto es una demo gratuita de Impulso IA. ¿Quieres algo asi para tu negocio?"}</span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <a href="https://impulso-ia-navy.vercel.app/#contacto" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 18px', borderRadius: 8, background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'transform 0.2s' }}>{isEN ? "Let's talk" : "Platiquemos"}</a>
        <a href="https://wa.me/525579605324?text=Hola%20Christian%2C%20me%20interesa%20saber%20m%C3%A1s%20sobre%20tus%20servicios%20de%20IA" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>WhatsApp</a>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
      </div>
    </div>
  );
}

// ─── ONBOARDING TOUR ──────────────────────────────────────────────────────────
function OnboardingTour({ lang, onSetTab, onGenerateForecast, chatbotRef, onOpenChatbot, onSendChatMessage }) {
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(true);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const tourLang = useRef(lang);

  const isEN = () => tourLang.current === 'en';

  const updateSpotlight = useCallback((selector) => {
    if (!selector) { setSpotlightRect(null); return; }
    const el = document.querySelector(selector);
    if (!el) { setSpotlightRect(null); return; }
    const rect = el.getBoundingClientRect();
    setSpotlightRect({ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 });
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const STEPS = useMemo(() => [
    // Step 0: Welcome modal
    {
      type: 'modal',
      title: { en: 'FinanceAI Dashboard', es: 'Dashboard FinanceAI' },
      text: {
        en: "AI-powered financial analytics with statistical anomaly detection (z-score), cash flow forecasting (linear regression), and an integrated AI chatbot. Analyze transactions across 7 spending categories with real-time insights.\n\nLet me show you!",
        es: "Analitica financiera con IA: deteccion estadistica de anomalias (z-score), proyeccion de flujo de caja (regresion lineal), y chatbot IA integrado. Analiza transacciones en 7 categorias de gasto con insights en tiempo real.\n\nDejame mostrarte!"
      },
      btn: { en: 'Start Tour', es: 'Iniciar Tour' },
      showLangSelector: true,
    },
    // Step 1: KPI Cards
    {
      type: 'spotlight',
      selector: '[data-tour="kpi-cards"]',
      title: { en: 'Key Performance Indicators', es: 'Indicadores Clave' },
      text: {
        en: 'These 4 cards show your main financial metrics: total spending, anomalies detected, top spending category, and monthly average. Each includes a sparkline showing the trend.',
        es: 'Estas 4 tarjetas muestran tus metricas financieras principales: gasto total, anomalias detectadas, categoria principal, y promedio mensual. Cada una incluye un sparkline con la tendencia.'
      },
      btn: { en: 'Next', es: 'Siguiente' },
    },
    // Step 2: Overview Charts
    {
      type: 'spotlight',
      selector: '[data-tour="overview-charts"]',
      title: { en: 'Overview Charts', es: 'Graficas de Resumen' },
      text: {
        en: 'The area chart shows monthly spending trends. The donut chart breaks down spending by category. Hover over any element for exact amounts.',
        es: 'La grafica de area muestra la tendencia mensual de gasto. La grafica de dona desglosa el gasto por categoria. Pasa el cursor sobre cualquier elemento para ver montos exactos.'
      },
      btn: { en: 'Next', es: 'Siguiente' },
    },
    // Step 3: Anomalies Tab
    {
      type: 'spotlight',
      selector: '[data-tour="anomalies-tab"]',
      title: { en: 'Anomaly Detection', es: 'Deteccion de Anomalias' },
      text: {
        en: 'Switching to the Anomalies tab... Transactions are flagged when they deviate more than 2 standard deviations from their category mean (z-score analysis). Click any anomaly for a detailed AI-powered statistical diagnosis.',
        es: 'Cambiando a la pestana de Anomalias... Las transacciones se marcan cuando se desvian mas de 2 desviaciones estandar de la media de su categoria (analisis z-score). Haz click en cualquier anomalia para un diagnostico estadistico detallado.'
      },
      btn: { en: 'Try it', es: 'Probarlo' },
      action: () => { onSetTab('anomalias'); },
    },
    // Step 4: Transactions Tab
    {
      type: 'spotlight',
      selector: '[data-tour="transactions-tab"]',
      title: { en: 'Transaction Explorer', es: 'Explorador de Transacciones' },
      text: {
        en: 'Switching to the Transactions tab... Browse all transactions with search and category filters. Anomalous transactions are highlighted in red with a "!" indicator.',
        es: 'Cambiando a la pestana de Transacciones... Explora todas las transacciones con busqueda y filtros por categoria. Las transacciones anomalas se resaltan en rojo con un indicador "!".'
      },
      btn: { en: 'Next', es: 'Siguiente' },
      action: () => { onSetTab('transacciones'); },
    },
    // Step 5: Projection Tab
    {
      type: 'spotlight',
      selector: '[data-tour="projection-tab"]',
      title: { en: 'Cash Flow Projection', es: 'Proyeccion de Flujo de Caja' },
      text: {
        en: 'Switching to Projection... This uses linear regression on your monthly data to forecast next month\'s spending. It generates alerts, recommendations, and an R-squared confidence score. Generating forecast now...',
        es: 'Cambiando a Proyeccion... Utiliza regresion lineal sobre tus datos mensuales para proyectar el gasto del proximo mes. Genera alertas, recomendaciones, y un score de confianza R-cuadrado. Generando forecast...'
      },
      btn: { en: 'Try it', es: 'Probarlo' },
      action: () => { onSetTab('proyeccion'); setTimeout(() => onGenerateForecast(), 300); },
    },
    // Step 6: AI Chatbot
    {
      type: 'spotlight',
      selector: '[data-tour="chatbot"]',
      title: { en: 'AI Financial Assistant', es: 'Asistente Financiero IA' },
      text: {
        en: 'The AI chatbot can answer questions about your data, explain anomalies, navigate sections, and generate insights. It uses Claude AI with tool-use for precise answers. Opening and asking about anomalies...',
        es: 'El chatbot IA puede responder preguntas sobre tus datos, explicar anomalias, navegar secciones, y generar insights. Usa Claude AI con tool-use para respuestas precisas. Abriendo y preguntando sobre anomalias...'
      },
      btn: { en: 'Try it', es: 'Probarlo' },
      action: () => {
        onSetTab('overview');
        setTimeout(() => {
          onOpenChatbot();
          setTimeout(() => onSendChatMessage(tourLang.current === 'en' ? 'Show me anomalies' : 'Muestra anomalias'), 500);
        }, 300);
      },
    },
    // Step 7: Finish
    {
      type: 'modal',
      title: { en: 'Tour Complete!', es: 'Tour Completado!' },
      text: {
        en: 'You\'ve seen all the key features of FinanceAI Dashboard:\n\n- KPI cards with sparkline trends\n- Monthly area chart + category donut\n- Statistical anomaly detection (z-score)\n- Transaction explorer with filters\n- Linear regression cash flow forecast\n- AI chatbot with Claude tool-use\n\nFeel free to explore on your own. You can also import your own CSV data!',
        es: 'Has visto todas las funcionalidades clave del Dashboard FinanceAI:\n\n- Tarjetas KPI con sparklines de tendencia\n- Grafica de area mensual + dona por categoria\n- Deteccion estadistica de anomalias (z-score)\n- Explorador de transacciones con filtros\n- Proyeccion de flujo de caja con regresion lineal\n- Chatbot IA con Claude tool-use\n\nExplora libremente. Tambien puedes importar tus propios datos CSV!'
      },
      btn: { en: 'Finish Tour', es: 'Finalizar Tour' },
    },
  ], [onSetTab, onGenerateForecast, onOpenChatbot, onSendChatMessage]);

  const totalSteps = STEPS.length;
  const currentStep = STEPS[step];

  useEffect(() => {
    if (!active || !currentStep) return;
    if (currentStep.action) {
      currentStep.action();
    }
    if (currentStep.selector) {
      const timer = setTimeout(() => updateSpotlight(currentStep.selector), 400);
      return () => clearTimeout(timer);
    } else {
      setSpotlightRect(null);
    }
  }, [step, active]);

  const advance = () => {
    if (step >= totalSteps - 1) {
      setActive(false);
      return;
    }
    setStep(s => s + 1);
  };

  const skip = () => setActive(false);

  if (!active) return null;

  const isModal = currentStep?.type === 'modal';

  return (
    <>
      <style>{`
        @keyframes tourFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tourPulseRing { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); } 50% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } }
      `}</style>

      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        pointerEvents: 'auto',
      }}>
        {/* Dark overlay with hole */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {spotlightRect && (
                <rect
                  x={spotlightRect.left} y={spotlightRect.top}
                  width={spotlightRect.width} height={spotlightRect.height}
                  rx="12" fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#tour-mask)" />
        </svg>

        {/* Spotlight ring */}
        {spotlightRect && (
          <div style={{
            position: 'absolute',
            top: spotlightRect.top, left: spotlightRect.left,
            width: spotlightRect.width, height: spotlightRect.height,
            border: '2px solid rgba(16,185,129,0.5)',
            borderRadius: 12,
            animation: 'tourPulseRing 2s infinite',
            pointerEvents: 'none',
          }} />
        )}

        {/* Tooltip / Modal */}
        {isModal ? (
          // Centered modal
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 460, maxWidth: '90vw',
            background: '#0D1117', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 16, padding: '32px 28px', boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
            animation: 'tourFadeIn 0.35s ease',
          }}>
            {/* Lang selector on welcome */}
            {currentStep.showLangSelector && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                {['es', 'en'].map(l => (
                  <button key={l} onClick={() => { tourLang.current = l; setStep(0); }} style={{
                    padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                    background: tourLang.current === l ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${tourLang.current === l ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: tourLang.current === l ? '#10B981' : 'rgba(255,255,255,0.4)',
                  }}>{l.toUpperCase()}</button>
                ))}
              </div>
            )}
            <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: '#F0FDF4', fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              {currentStep.title[tourLang.current]}
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>
              {currentStep.text[tourLang.current]}
            </p>
            {/* Step counter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Mono', monospace" }}>
                {step + 1} / {totalSteps}
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={skip} style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  padding: '8px 16px', cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.4)',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {isEN() ? 'Skip' : 'Saltar'}
                </button>
                <button onClick={advance} style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  border: 'none', borderRadius: 8, padding: '8px 20px',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff',
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: '0 0 20px rgba(16,185,129,0.3)',
                }}>
                  {step === totalSteps - 1
                    ? (isEN() ? 'Finish Tour' : 'Finalizar Tour')
                    : (currentStep.btn[tourLang.current] + ' →')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Positioned tooltip near spotlight
          <div style={{
            position: 'absolute',
            top: spotlightRect ? spotlightRect.top + spotlightRect.height + 16 : '50%',
            left: spotlightRect ? Math.min(Math.max(spotlightRect.left, 20), window.innerWidth - 420) : '50%',
            ...(spotlightRect ? {} : { transform: 'translate(-50%,-50%)' }),
            width: 400, maxWidth: '90vw',
            background: '#0D1117', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 14, padding: '20px 22px', boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            animation: 'tourFadeIn 0.3s ease',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#10B981' }}>
              {currentStep.title[tourLang.current]}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {currentStep.text[tourLang.current]}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Mono', monospace" }}>
                {step + 1} / {totalSteps}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={skip} style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                  padding: '6px 12px', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.35)',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {isEN() ? 'Skip Tour' : 'Saltar Tour'}
                </button>
                <button onClick={advance} style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  border: 'none', borderRadius: 6, padding: '6px 16px',
                  cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff',
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: '0 0 16px rgba(16,185,129,0.3)',
                }}>
                  {currentStep.btn[tourLang.current] + ' →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
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
  const [lang, setLang] = useState('es');

  const t = useMemo(() => {
    const strings = {
      es: {
        // Tabs
        overview: "Overview",
        anomalias: "Anomalias",
        transacciones: "Transacciones",
        proyeccion: "Proyeccion",
        // KPI labels
        gastoTotal: "Gasto Total",
        anomaliasDetectadas: "Anomalias Detectadas",
        mayorCategoria: "Mayor Categoria",
        promedioMensual: "Promedio Mensual",
        // KPI sub
        mesesDeDatos: "meses de datos",
        delTotal: "del total (umbral: 2\u03C3)",
        meses: "meses",
        // Overview sections
        tendenciaMensual: "Tendencia Mensual de Gasto",
        gastoPorCategoria: "Gasto por Categoria",
        ultimasAnomalias: "Ultimas Anomalias",
        noAnomalias: "No se detectaron anomalias estadisticas (umbral: 2 desv. estandar)",
        verTodasAnomalias: "Ver todas las anomalias",
        // Anomalias tab
        anomaliasDetectadasMsg: "anomalias detectadas (> 2 desviaciones estandar)",
        noAnomaliasEstadisticas: "No se detectaron anomalias estadisticas",
        ordenadasPorScore: "Ordenadas por score de riesgo",
        distribucionRiesgo: "Distribucion de Riesgo",
        noAnomaliasDetectadas: "No se detectaron anomalias",
        todasDentroRango: "Todas las transacciones estan dentro de 2 desviaciones estandar de su media por categoria.",
        analisisEstadistico: "Analisis Estadistico",
        calculandoEstadisticas: "Calculando estadisticas...",
        reintentarAnalisis: "Reintentar analisis",
        riesgo: "riesgo",
        desviacion: "desviacion",
        analizarIA: "Analizar IA",
        // Transacciones tab
        buscarTransaccion: "Buscar transaccion...",
        todasCategorias: "Todas las categorias",
        descripcion: "Descripcion",
        categoria: "Categoria",
        fecha: "Fecha",
        monto: "Monto",
        noTransacciones: "No se encontraron transacciones con los filtros aplicados.",
        // Proyeccion tab
        proyeccionFinanciera: "Proyeccion Financiera",
        generaProyeccion: "Genera una proyeccion basada en regresion lineal de tus datos",
        importados: "importados",
        ultimos90Dias: "de los ultimos 90 dias",
        generarProyeccion: "Generar Proyeccion",
        calculandoRegresion: "Calculando regresion lineal y tendencias...",
        proyeccionProximoMes: "Proyeccion Proximo Mes",
        tendencia: "Tendencia",
        variacionEsperada: "Variacion Esperada",
        tendenciasPorCategoria: "Tendencias por Categoria (mes a mes)",
        modeloRegresion: "Modelo de Regresion Lineal",
        pendiente: "Pendiente",
        ajuste: "Ajuste",
        bueno: "Bueno",
        moderado: "Moderado",
        bajo: "Bajo",
        historicoVsProyeccion: "Historico vs Proyeccion",
        historico: "Historico",
        proyeccionLabel: "Proyeccion",
        promedio: "Promedio",
        alertas: "Alertas",
        recomendaciones: "Recomendaciones",
        resumenEjecutivo: "Resumen Ejecutivo",
        regenerarProyeccion: "Regenerar proyeccion",
        reintentar: "Reintentar",
        // Data source banner
        datosDemo: "Datos demo:",
        transaccionesGeneradas: "transacciones generadas",
        anomaliasDetectadasBanner: "anomalias detectadas",
        volverADemo: "Volver a demo",
        // Import panel
        importarCSV: "Importar CSV",
        pegarDatos: "Pegar datos",
        importarArchivoCSV: "Importar archivo CSV",
        formatoEsperado: "FORMATO ESPERADO (CSV o tab-separado):",
        columnasMinimas: "Columnas minimas: fecha + monto. Acepta formatos: YYYY-MM-DD, DD/MM/YYYY. Separadores: coma, tab, punto y coma.",
        seleccionarArchivo: "Seleccionar archivo CSV",
        procesarDatos: "Procesar datos",
        advertencias: "Advertencias",
        yMas: "mas",
        confirmarImportacion: "Confirmar importacion",
        // Header
        subtitulo: "Dashboard financiero \u00B7 Deteccion de anomalias \u00B7 Proyecciones IA",
        // Footer
        footer: "FINANCEAI \u00B7 DETECCION ESTADISTICA DE ANOMALIAS \u00B7 REGRESION LINEAL \u00B7 IMPORTACION DE DATOS",
        // Chatbot
        asistente: "Asistente FinanceAI",
        teExplico: "Te explico cada seccion del dashboard",
        preguntaSobre: "Pregunta sobre el dashboard...",
        chatGreeting: "Hola, soy el asistente de **FinanceAI**. Puedo explicarte que muestra cada seccion, como funcionan las anomalias, la proyeccion, o como importar tus datos. \u00BFEn que te ayudo?",
        queEsEsto: "\u00BFQue es esto?",
        importarDatos: "Importar datos",
        metodologia: "Metodologia",
        // Anomaly row
        anomaliasLabel: "anomalias",
        gasto: "Gasto",
      },
      en: {
        overview: "Overview",
        anomalias: "Anomalies",
        transacciones: "Transactions",
        proyeccion: "Projection",
        gastoTotal: "Total Spending",
        anomaliasDetectadas: "Anomalies Detected",
        mayorCategoria: "Top Category",
        promedioMensual: "Monthly Average",
        mesesDeDatos: "months of data",
        delTotal: "of total (threshold: 2\u03C3)",
        meses: "months",
        tendenciaMensual: "Monthly Spending Trend",
        gastoPorCategoria: "Spending by Category",
        ultimasAnomalias: "Recent Anomalies",
        noAnomalias: "No statistical anomalies detected (threshold: 2 std. dev.)",
        verTodasAnomalias: "View all anomalies",
        anomaliasDetectadasMsg: "anomalies detected (> 2 standard deviations)",
        noAnomaliasEstadisticas: "No statistical anomalies detected",
        ordenadasPorScore: "Sorted by risk score",
        distribucionRiesgo: "Risk Distribution",
        noAnomaliasDetectadas: "No anomalies detected",
        todasDentroRango: "All transactions are within 2 standard deviations of their category mean.",
        analisisEstadistico: "Statistical Analysis",
        calculandoEstadisticas: "Computing statistics...",
        reintentarAnalisis: "Retry analysis",
        riesgo: "risk",
        desviacion: "deviation",
        analizarIA: "AI Analyze",
        buscarTransaccion: "Search transaction...",
        todasCategorias: "All categories",
        descripcion: "Description",
        categoria: "Category",
        fecha: "Date",
        monto: "Amount",
        noTransacciones: "No transactions found matching the applied filters.",
        proyeccionFinanciera: "Financial Projection",
        generaProyeccion: "Generate a projection based on linear regression of your",
        importados: "imported data",
        ultimos90Dias: "last 90 days of data",
        generarProyeccion: "Generate Projection",
        calculandoRegresion: "Computing linear regression and trends...",
        proyeccionProximoMes: "Next Month Projection",
        tendencia: "Trend",
        variacionEsperada: "Expected Variation",
        tendenciasPorCategoria: "Category Trends (month over month)",
        modeloRegresion: "Linear Regression Model",
        pendiente: "Slope",
        ajuste: "Fit",
        bueno: "Good",
        moderado: "Moderate",
        bajo: "Low",
        historicoVsProyeccion: "Historical vs Projection",
        historico: "Historical",
        proyeccionLabel: "Projection",
        promedio: "Average",
        alertas: "Alerts",
        recomendaciones: "Recommendations",
        resumenEjecutivo: "Executive Summary",
        regenerarProyeccion: "Regenerate projection",
        reintentar: "Retry",
        datosDemo: "Demo data:",
        transaccionesGeneradas: "generated transactions",
        anomaliasDetectadasBanner: "anomalies detected",
        volverADemo: "Back to demo",
        importarCSV: "Import CSV",
        pegarDatos: "Paste data",
        importarArchivoCSV: "Import CSV file",
        formatoEsperado: "EXPECTED FORMAT (CSV or tab-separated):",
        columnasMinimas: "Minimum columns: date + amount. Formats: YYYY-MM-DD, DD/MM/YYYY. Separators: comma, tab, semicolon.",
        seleccionarArchivo: "Select CSV file",
        procesarDatos: "Process data",
        advertencias: "Warnings",
        yMas: "more",
        confirmarImportacion: "Confirm import",
        subtitulo: "Financial dashboard \u00B7 Anomaly detection \u00B7 AI projections",
        footer: "FINANCEAI \u00B7 STATISTICAL ANOMALY DETECTION \u00B7 LINEAR REGRESSION \u00B7 DATA IMPORT",
        asistente: "FinanceAI Assistant",
        teExplico: "I can explain each dashboard section",
        preguntaSobre: "Ask about the dashboard...",
        chatGreeting: "Hi, I'm the **FinanceAI** assistant. I can explain what each section shows, how anomaly detection works, the projection model, or how to import your data. How can I help?",
        queEsEsto: "What is this?",
        importarDatos: "Import data",
        metodologia: "Methodology",
        anomaliasLabel: "anomalies",
        gasto: "Spending",
      },
    };
    return strings[lang];
  }, [lang]);

  const analysisRef = useRef(null);
  const anomalyRowRefs = useRef({});
  const chatbotOpenRef = useRef(null);
  const chatbotSendRef = useRef(null);

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
    {/* ElevenLabs Voice Agent */}
    <div style={{ position: "fixed", bottom: 24, left: 24, zIndex: 9999 }}
      dangerouslySetInnerHTML={{ __html: '<elevenlabs-convai agent-id="agent_5601kmfx9vnzeb691cj64x2khmm0"></elevenlabs-convai>' }}
    />
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
              {t.subtitulo}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[
              { key: "overview", label: t.overview },
              { key: "anomalias", label: t.anomalias },
              { key: "transacciones", label: t.transacciones },
              { key: "proyeccion", label: t.proyeccion },
            ].map(tab => (
              <button key={tab.key} style={tabStyle(tab.key)} onClick={() => setActiveTab(tab.key)}>
                {tab.label}
              </button>
            ))}
            <button
              onClick={() => setLang(prev => prev === 'es' ? 'en' : 'es')}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                marginLeft: 6,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontWeight: lang === 'es' ? 700 : 400, color: lang === 'es' ? accent : 'rgba(255,255,255,0.4)' }}>ES</span>
              <span style={{ margin: '0 4px', color: 'rgba(255,255,255,0.2)' }}>/</span>
              <span style={{ fontWeight: lang === 'en' ? 700 : 400, color: lang === 'en' ? accent : 'rgba(255,255,255,0.4)' }}>EN</span>
            </button>
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
                : `${t.datosDemo} ${transactions.length} ${t.transaccionesGeneradas} · ${anomalies.length} ${t.anomaliasDetectadasBanner}`}
            </span>
            {dataSource === "imported" && (
              <button onClick={handleResetToMock} style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6, padding: "3px 10px", cursor: "pointer",
                fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif",
              }}>
                {t.volverADemo}
              </button>
            )}
          </div>
          <ImportPanel onImport={handleImport} t={t} />
        </div>

        {/* KPI CARDS */}
        <div data-tour="kpi-cards" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: t.gastoTotal, value: fmt(metrics.total), rawValue: metrics.total, sub: `${Object.keys(metrics.monthly).length} ${t.mesesDeDatos}`, color: accent, trend: monthlyValues, isCurrency: true },
            { label: t.anomaliasDetectadas, value: String(anomalies.length), rawValue: anomalies.length, sub: `${transactions.length > 0 ? Math.round((anomalies.length / transactions.length) * 100) : 0}% ${t.delTotal}`, color: "#EF4444", alert: true },
            { label: t.mayorCategoria, value: Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A", sub: fmt(Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1])[0]?.[1] || 0), color: "#F59E0B", isText: true },
            { label: t.promedioMensual, value: fmt(metrics.total / Math.max(Object.keys(metrics.monthly).length, 1)), rawValue: Math.round(metrics.total / Math.max(Object.keys(metrics.monthly).length, 1)), sub: `${Object.keys(metrics.monthly).length} ${t.meses}`, color: "#8B5CF6", trend: monthlyValues, isCurrency: true },
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
          <div data-tour="overview-charts">
            {/* Monthly Trend AreaChart */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "'DM Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "'DM Mono', monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} width={80} />
                  <Tooltip content={<DarkTooltip />} />
                  <Area type="monotone" dataKey="total" name={t.gasto} stroke="#10B981" strokeWidth={2} fill="url(#areaGradient)" dot={{ r: 3, fill: "#10B981", stroke: "#080C10", strokeWidth: 2 }} activeDot={{ r: 5, fill: "#10B981", stroke: "#080C10", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
              {/* Category PieChart + existing category legend */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20 }}>
                <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
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
                    {Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                      <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: getCatColor(cat), flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", flex: 1 }}>{cat}</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>{fmt(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <MiniBarChart data={metrics.byCategory} />
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20 }}>
                <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
                  {t.ultimasAnomalias}
                </p>
                {anomalies.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0" }}>
                    <p style={{ fontSize: 24, margin: "0 0 8px" }}>OK</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>{t.noAnomalias}</p>
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
                    {t.verTodasAnomalias}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ANOMALIAS */}
        {activeTab === "anomalias" && (
          <div data-tour="anomalies-tab" style={{ animation: "fadeUp 0.3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#F1F5F9", fontWeight: 600 }}>
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
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
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
                          <div style={{ background: "#1E293B", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px", fontFamily: "'DM Mono', monospace" }}>
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
                </div>
              );
            })()}

            {anomalies.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "48px 20px",
                background: "rgba(16,185,129,0.05)",
                border: "1px solid rgba(16,185,129,0.15)",
                borderRadius: 12,
              }}>
                <p style={{ fontSize: 36, margin: "0 0 12px" }}>OK</p>
                <p style={{ fontSize: 15, color: accent, fontWeight: 600, margin: "0 0 6px" }}>
                  {t.noAnomaliasDetectadas}
                </p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                  {t.todasDentroRango}
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
                  t={t}
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
                    {t.analisisEstadistico} — {selectedTx.description}
                  </p>
                  <button onClick={() => setSelectedTx(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16 }}>X</button>
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
                    <button onClick={() => analyzeAnomaly(selectedTx)} style={{
                      background: "rgba(16,185,129,0.12)", border: `1px solid ${accent}40`,
                      borderRadius: 6, padding: "7px 18px", cursor: "pointer",
                      fontSize: 12, color: accent, fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {t.reintentarAnalisis}
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
          <div data-tour="transactions-tab" style={{ animation: "fadeUp 0.3s ease" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={t.buscarTransaccion}
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
                <option style={{ background: "#1a1a2e" }} value="Todas">{t.todasCategorias}</option>
                {allCategories.map(c => (
                  <option key={c} style={{ background: "#1a1a2e" }} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {[t.descripcion, t.categoria, t.fecha, t.monto].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{h}</span>
                ))}
              </div>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {recentTxs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0" }}>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                      {t.noTransacciones}
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
          <div data-tour="projection-tab" style={{ animation: "fadeUp 0.3s ease" }}>
            {!forecastData && !loadingForecast && !forecastError && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ fontSize: 18, margin: "0 0 12px", color: "rgba(255,255,255,0.3)" }}>{t.proyeccionFinanciera}</p>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
                  {t.generaProyeccion} {dataSource === "imported" ? t.importados : t.ultimos90Dias}
                </p>
                <button onClick={generateForecast} style={{
                  background: `linear-gradient(135deg, ${accent}, #059669)`,
                  border: "none", borderRadius: 10, padding: "13px 32px",
                  fontSize: 14, fontWeight: 700, color: "#fff",
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  boxShadow: `0 0 24px ${accent}40`,
                }}>
                  {t.generarProyeccion}
                </button>
              </div>
            )}

            {loadingForecast && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${accent}30`, borderTop: `3px solid ${accent}`, animation: "spinAnim 1s linear infinite", margin: "0 auto 16px" }} />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "0 0 24px" }}>{t.calculandoRegresion}</p>
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
                    <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 16 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>{k.label}</p>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: k.color, fontFamily: "'DM Mono', monospace" }}>{k.value}</p>
                    </div>
                  ))}
                </div>

                {/* Category trends */}
                {forecastData.catTrends && Object.keys(forecastData.catTrends).length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{t.tendenciasPorCategoria}</p>
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
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#8B5CF6", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{t.modeloRegresion}</p>
                    <div style={{ display: "flex", gap: 20 }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>
                        {t.pendiente}: {fmt(Math.round(forecastData.regression.slope))}/{lang === 'es' ? 'mes' : 'mo'}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>
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
                  // Build chart data: historical + projected point
                  const chartData = monthlyEntries.map(([month, total], i) => ({
                    month: month.slice(2),
                    historico: total,
                    proyeccion: null,
                  }));
                  // Add the last historical point also as projection start
                  if (chartData.length > 0) {
                    chartData[chartData.length - 1].proyeccion = chartData[chartData.length - 1].historico;
                  }
                  // Add projected month
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
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 20, marginBottom: 12 }}>
                      <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
                        {t.historicoVsProyeccion}
                      </p>
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "'DM Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                          <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "'DM Mono', monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} width={80} />
                          <Tooltip content={<DarkTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.4)" }} />
                          <ReferenceLine y={Math.round(avg)} stroke="rgba(255,255,255,0.15)" strokeDasharray="6 4" label={{ value: `${t.promedio}: ${fmt(Math.round(avg))}`, position: "insideTopRight", fill: "rgba(255,255,255,0.25)", fontSize: 10, fontFamily: "'DM Mono', monospace" }} />
                          <Line type="monotone" dataKey="historico" name={t.historico} stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: "#10B981", stroke: "#080C10", strokeWidth: 2 }} connectNulls={false} />
                          <Line type="monotone" dataKey="proyeccion" name={t.proyeccionLabel} stroke="#8B5CF6" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 4, fill: "#8B5CF6", stroke: "#080C10", strokeWidth: 2 }} connectNulls={false} />
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
                <div style={{ marginTop: 12, padding: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.resumenEjecutivo}</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#D1D5DB", lineHeight: 1.7 }}>{forecastData.resumen}</p>
                </div>
                <button onClick={generateForecast} style={{
                  marginTop: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
                  borderRadius: 8, padding: "9px 18px", fontSize: 12, color: accent,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
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
                <button onClick={generateForecast} style={{
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
        )}

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: "rgba(255,255,255,0.1)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>
          {t.footer}
        </p>
      </div>
    </div>
    <FinanceChatbot
      metrics={metrics}
      transactions={transactions}
      anomalies={anomalies}
      forecastData={forecastData}
      activeTab={activeTab}
      onNavigate={setActiveTab}
      lang={lang}
      t={t}
      onExposeControls={(ctrls) => { chatbotOpenRef.current = ctrls.open; chatbotSendRef.current = ctrls.send; }}
    />
    <OnboardingTour
      lang={lang}
      onSetTab={setActiveTab}
      onGenerateForecast={generateForecast}
      onOpenChatbot={() => { if (chatbotOpenRef.current) chatbotOpenRef.current(); }}
      onSendChatMessage={(msg) => { if (chatbotSendRef.current) chatbotSendRef.current(msg); }}
    />
    <ContactBar lang={lang} />
    </>
  );
}
