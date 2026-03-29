// ─── CHATBOT TOOL EXECUTOR ───────────────────────────────────────────────────
// Executes tool calls from Claude API against local dashboard data.

import { linearRegression } from '../../utils/statistics';

/**
 * Execute a tool call and return the result object.
 * @param {string} toolName
 * @param {object} toolInput
 * @param {{ anomalies, metrics, transactions, forecastData }} ctx - Dashboard context
 * @returns {object}
 */
export function executeToolCall(toolName, toolInput, ctx) {
  const { anomalies, metrics, transactions, forecastData } = ctx;

  try {
    switch (toolName) {
      case "detect_anomalies": {
        let filtered = [...anomalies];
        if (toolInput.category) {
          filtered = filtered.filter(a =>
            a.categoria?.toLowerCase() === toolInput.category.toLowerCase() ||
            a.category?.toLowerCase() === toolInput.category.toLowerCase()
          );
        }
        if (toolInput.risk_level && toolInput.risk_level !== "all") {
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
}
