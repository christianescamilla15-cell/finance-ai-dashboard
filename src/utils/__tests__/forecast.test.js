import { describe, it, expect } from 'vitest';
import { generateRealForecast } from '../forecast';

// Helper to build metrics object similar to computeMetrics output
const buildMetrics = (transactions) => {
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const byCategory = {};
  transactions.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = 0;
    byCategory[t.category] += t.amount;
  });
  const monthly = {};
  transactions.forEach(t => {
    const m = t.date.slice(0, 7);
    if (!monthly[m]) monthly[m] = 0;
    monthly[m] += t.amount;
  });
  return { total, byCategory, monthly, anomalies: [] };
};

const makeTx = (amount, category, date) => ({
  id: `TX-${Math.random()}`,
  date,
  category,
  amount,
  description: `${category} transaction`,
});

describe('generateRealForecast', () => {
  it('returns error when fewer than 2 months of data', () => {
    const txs = [makeTx(100, 'Food', '2024-01-15')];
    const metrics = buildMetrics(txs);
    const result = generateRealForecast(txs, metrics);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('insuficientes');
  });

  it('returns a valid forecast with 2 months of data', () => {
    const txs = [
      makeTx(1000, 'Food', '2024-01-15'),
      makeTx(1200, 'Food', '2024-02-15'),
    ];
    const metrics = buildMetrics(txs);
    const result = generateRealForecast(txs, metrics);
    expect(result.proyeccion_mes).toBeGreaterThan(0);
    expect(result.tendencia).toBeDefined();
    expect(result.resumen).toBeDefined();
  });

  it('detects upward trend (alcista)', () => {
    const txs = [
      makeTx(1000, 'Food', '2024-01-15'),
      makeTx(2000, 'Food', '2024-02-15'),
      makeTx(3000, 'Food', '2024-03-15'),
    ];
    const metrics = buildMetrics(txs);
    const result = generateRealForecast(txs, metrics);
    expect(result.tendencia).toBe('alcista');
    expect(result.variacion_esperada).toBeGreaterThan(0);
  });

  it('detects downward trend (bajista)', () => {
    const txs = [
      makeTx(3000, 'Food', '2024-01-15'),
      makeTx(2000, 'Food', '2024-02-15'),
      makeTx(1000, 'Food', '2024-03-15'),
    ];
    const metrics = buildMetrics(txs);
    const result = generateRealForecast(txs, metrics);
    expect(result.tendencia).toBe('bajista');
    expect(result.variacion_esperada).toBeLessThan(0);
  });

  it('detects flat/stable trend (estable)', () => {
    const txs = [
      makeTx(1000, 'Food', '2024-01-15'),
      makeTx(1010, 'Food', '2024-02-15'),
      makeTx(1005, 'Food', '2024-03-15'),
    ];
    const metrics = buildMetrics(txs);
    const result = generateRealForecast(txs, metrics);
    expect(result.tendencia).toBe('estable');
  });

  it('includes category trends (catTrends)', () => {
    const txs = [
      makeTx(500, 'Food', '2024-01-15'),
      makeTx(800, 'Food', '2024-02-15'),
      makeTx(200, 'Rent', '2024-01-15'),
      makeTx(200, 'Rent', '2024-02-15'),
    ];
    const metrics = buildMetrics(txs);
    const result = generateRealForecast(txs, metrics);
    expect(result.catTrends).toBeDefined();
    expect(result.catTrends['Food']).toBeGreaterThan(0);
  });

  it('generates alerts for high category concentration', () => {
    // One category dominates > 30%
    const txs = [
      makeTx(9000, 'Rent', '2024-01-15'),
      makeTx(9000, 'Rent', '2024-02-15'),
      makeTx(100, 'Food', '2024-01-15'),
      makeTx(100, 'Food', '2024-02-15'),
    ];
    const metrics = buildMetrics(txs);
    const result = generateRealForecast(txs, metrics);
    const concAlert = result.alertas.find(a => a.includes('concentra'));
    expect(concAlert).toBeDefined();
  });

  it('generates recommendations array', () => {
    const txs = [
      makeTx(1000, 'Food', '2024-01-15'),
      makeTx(1500, 'Food', '2024-02-15'),
    ];
    const metrics = buildMetrics(txs);
    const result = generateRealForecast(txs, metrics);
    expect(result.recomendaciones).toBeDefined();
    expect(result.recomendaciones.length).toBeGreaterThan(0);
    // Should always include budget suggestion
    const budgetRec = result.recomendaciones.find(r => r.includes('Presupuesto sugerido'));
    expect(budgetRec).toBeDefined();
  });

  it('includes regression info', () => {
    const txs = [
      makeTx(1000, 'Food', '2024-01-15'),
      makeTx(2000, 'Food', '2024-02-15'),
    ];
    const metrics = buildMetrics(txs);
    const result = generateRealForecast(txs, metrics);
    expect(result.regression).toBeDefined();
    expect(result.regression).toHaveProperty('slope');
    expect(result.regression).toHaveProperty('intercept');
    expect(result.regression).toHaveProperty('r2');
  });

  it('handles all transactions in the same category', () => {
    const txs = [
      makeTx(1000, 'Utilities', '2024-01-15'),
      makeTx(1100, 'Utilities', '2024-02-15'),
      makeTx(1200, 'Utilities', '2024-03-15'),
    ];
    const metrics = buildMetrics(txs);
    const result = generateRealForecast(txs, metrics);
    expect(result.proyeccion_mes).toBeGreaterThan(0);
    expect(result.tendencia).toBeDefined();
  });
});
