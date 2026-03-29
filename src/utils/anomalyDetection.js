// ─── ANOMALY DETECTION (REAL STATISTICAL) ───────────────────────────────────
import { calcMean, calcStdDev } from './statistics';

export const detectAnomalies = (transactions) => {
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
