// ─── STATISTICAL UTILITIES ──────────────────────────────────────────────────

export const calcMean = (arr) => arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;

export const calcStdDev = (arr) => {
  if (arr.length < 2) return 0;
  const m = calcMean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
};

// Linear regression: returns { slope, intercept, r2 }
export const linearRegression = (xs, ys) => {
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
