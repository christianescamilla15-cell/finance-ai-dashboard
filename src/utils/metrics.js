// ─── METRICS ─────────────────────────────────────────────────────────────────
import { calcMean, calcStdDev } from './statistics';

export const computeMetrics = (txs) => {
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
