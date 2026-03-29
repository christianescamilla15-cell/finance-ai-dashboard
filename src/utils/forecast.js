// ─── REAL FORECAST (client-side linear regression) ──────────────────────────
import { calcMean, calcStdDev, linearRegression } from './statistics';
import { fmt } from './formatting';

export function generateRealForecast(transactions, metrics) {
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
