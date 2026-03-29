// ─── REAL ANOMALY ANALYSIS (client-side) ─────────────────────────────────────
import { calcMean, calcStdDev } from './statistics';
import { fmt } from './formatting';

export function generateRealAnalysis(tx, allTransactions) {
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
  const monthlyStdDev = calcStdDev(monthlyValues);

  // Determine risk level from actual anomaly score
  let riskLevel;
  if (riskScore >= 70) { riskLevel = "ALTO"; }
  else if (riskScore >= 40) { riskLevel = "MEDIO"; }
  else { riskLevel = "BAJO"; }

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
