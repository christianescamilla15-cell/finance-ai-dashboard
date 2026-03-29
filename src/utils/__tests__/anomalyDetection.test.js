import { describe, it, expect } from 'vitest';
import { detectAnomalies } from '../anomalyDetection';

const makeTx = (amount, category = 'Food', date = '2024-01-15') => ({
  id: `TX-${Math.random()}`,
  date,
  category,
  amount,
  description: `${category} transaction`,
});

describe('detectAnomalies', () => {
  it('returns an empty array for empty transactions', () => {
    expect(detectAnomalies([])).toEqual([]);
  });

  it('handles a single transaction without crashing', () => {
    const result = detectAnomalies([makeTx(100)]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('isAnomaly');
    expect(result[0]).toHaveProperty('anomalyScore');
  });

  it('marks no anomalies when all amounts are identical', () => {
    const txs = Array.from({ length: 10 }, () => makeTx(100));
    const result = detectAnomalies(txs);
    result.forEach(r => {
      expect(r.isAnomaly).toBe(false);
      expect(r.anomalyScore).toBe(0);
    });
  });

  it('detects a clear outlier as anomaly', () => {
    // 9 transactions at 100, 1 at 10000
    const txs = Array.from({ length: 9 }, () => makeTx(100));
    txs.push(makeTx(10000));
    const result = detectAnomalies(txs);
    const outlier = result.find(r => r.amount === 10000);
    expect(outlier.isAnomaly).toBe(true);
    expect(outlier.anomalyScore).toBeGreaterThan(0);
  });

  it('normalizes anomaly scores to [0, 1] range', () => {
    const txs = Array.from({ length: 9 }, () => makeTx(100));
    txs.push(makeTx(100000)); // extreme outlier
    const result = detectAnomalies(txs);
    result.forEach(r => {
      expect(r.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(r.anomalyScore).toBeLessThanOrEqual(1);
    });
  });

  it('uses global stats as fallback when category has fewer than 3 items', () => {
    // Create enough spread so the outlier is clearly anomalous
    const txs = [
      makeTx(100, 'Food'),
      makeTx(100, 'Food'),
      makeTx(100, 'Food'),
      makeTx(100, 'Food'),
      makeTx(100, 'Food'),
      makeTx(100, 'Food'),
      makeTx(100, 'Food'),
      makeTx(100, 'Food'),
      makeTx(100, 'Food'),
      makeTx(50000, 'Travel'), // only 1 in Travel, falls back to global stats
    ];
    const result = detectAnomalies(txs);
    const travel = result.find(r => r.category === 'Travel');
    expect(travel).toHaveProperty('isAnomaly');
    expect(travel.isAnomaly).toBe(true);
  });

  it('uses category-specific stats when enough data exists', () => {
    // Food: 10 items around 100, one at 500
    const foodTxs = Array.from({ length: 10 }, () => makeTx(100, 'Food'));
    foodTxs.push(makeTx(500, 'Food'));
    // Rent: 10 items around 5000
    const rentTxs = Array.from({ length: 10 }, () => makeTx(5000, 'Rent'));

    const result = detectAnomalies([...foodTxs, ...rentTxs]);
    // Rent transactions should NOT be anomalous even though amounts are high globally
    const rentResults = result.filter(r => r.category === 'Rent');
    rentResults.forEach(r => {
      expect(r.isAnomaly).toBe(false);
    });
  });

  it('handles two transactions (stddev calculable)', () => {
    const txs = [makeTx(100), makeTx(200)];
    const result = detectAnomalies(txs);
    expect(result).toHaveLength(2);
    result.forEach(r => {
      expect(r).toHaveProperty('_deviation');
    });
  });

  it('marks transactions above 2 stddevs as anomalies', () => {
    // Create data where one item is exactly far from mean
    const txs = Array.from({ length: 20 }, () => makeTx(100, 'A'));
    txs.push(makeTx(100, 'A')); // keep same
    // Add a large outlier to the same category
    txs.push(makeTx(1000, 'A'));
    const result = detectAnomalies(txs);
    const outlier = result.find(r => r.amount === 1000);
    expect(outlier.isAnomaly).toBe(true);
    expect(outlier._deviation).toBeGreaterThan(2);
  });

  it('preserves original transaction properties', () => {
    const tx = makeTx(100, 'Food', '2024-03-15');
    const result = detectAnomalies([tx]);
    expect(result[0].amount).toBe(100);
    expect(result[0].category).toBe('Food');
    expect(result[0].date).toBe('2024-03-15');
  });

  it('handles multiple categories with different distributions', () => {
    const cheap = Array.from({ length: 10 }, () => makeTx(50, 'Snacks'));
    const expensive = Array.from({ length: 10 }, () => makeTx(5000, 'Electronics'));
    const result = detectAnomalies([...cheap, ...expensive]);
    // None should be anomalous within their own categories
    result.forEach(r => {
      expect(r.isAnomaly).toBe(false);
    });
  });

  it('caps anomaly score at maximum 1 (score is always <= 1)', () => {
    // Anomaly score = min(deviation / 5, 1), so even extreme outliers cap at 1
    // With global fallback the stddev includes the outlier itself, reducing deviation
    // Test the normalization invariant: all scores in [0, 1]
    const txs = Array.from({ length: 20 }, () => makeTx(100));
    txs.push(makeTx(1000000));
    const result = detectAnomalies(txs);
    result.forEach(r => {
      expect(r.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(r.anomalyScore).toBeLessThanOrEqual(1);
    });
    // The extreme outlier should still be flagged as anomaly
    const extreme = result.find(r => r.amount === 1000000);
    expect(extreme.isAnomaly).toBe(true);
    expect(extreme.anomalyScore).toBeGreaterThan(0.5);
  });
});
