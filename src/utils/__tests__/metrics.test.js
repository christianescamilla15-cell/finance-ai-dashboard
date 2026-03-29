import { describe, it, expect } from 'vitest';
import { computeMetrics } from '../metrics';

const makeTx = (amount, category, date, isAnomaly = false) => ({
  id: `TX-${Math.random()}`,
  date,
  category,
  amount,
  description: `${category} transaction`,
  isAnomaly,
  anomalyScore: isAnomaly ? 0.8 : 0.1,
});

describe('computeMetrics', () => {
  it('returns zero total for empty transactions', () => {
    const result = computeMetrics([]);
    expect(result.total).toBe(0);
    expect(result.anomalies).toHaveLength(0);
  });

  it('calculates total correctly', () => {
    const txs = [
      makeTx(100, 'Food', '2024-01-15'),
      makeTx(200, 'Rent', '2024-01-15'),
      makeTx(300, 'Transport', '2024-01-15'),
    ];
    const result = computeMetrics(txs);
    expect(result.total).toBe(600);
  });

  it('groups amounts by category correctly', () => {
    const txs = [
      makeTx(100, 'Food', '2024-01-15'),
      makeTx(200, 'Food', '2024-01-16'),
      makeTx(500, 'Rent', '2024-01-15'),
    ];
    const result = computeMetrics(txs);
    expect(result.byCategory['Food']).toBe(300);
    expect(result.byCategory['Rent']).toBe(500);
  });

  it('aggregates monthly totals correctly', () => {
    const txs = [
      makeTx(100, 'Food', '2024-01-15'),
      makeTx(200, 'Food', '2024-01-20'),
      makeTx(300, 'Food', '2024-02-10'),
    ];
    const result = computeMetrics(txs);
    expect(result.monthly['2024-01']).toBe(300);
    expect(result.monthly['2024-02']).toBe(300);
  });

  it('collects anomalies correctly', () => {
    const txs = [
      makeTx(100, 'Food', '2024-01-15', false),
      makeTx(5000, 'Food', '2024-01-15', true),
      makeTx(200, 'Rent', '2024-01-15', false),
    ];
    const result = computeMetrics(txs);
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies[0].amount).toBe(5000);
  });

  it('handles a single transaction', () => {
    const txs = [makeTx(999, 'Misc', '2024-06-01')];
    const result = computeMetrics(txs);
    expect(result.total).toBe(999);
    expect(result.byCategory['Misc']).toBe(999);
    expect(result.monthly['2024-06']).toBe(999);
  });

  it('computes category stats with mean and stddev', () => {
    const txs = [
      makeTx(100, 'Food', '2024-01-15'),
      makeTx(200, 'Food', '2024-01-16'),
      makeTx(300, 'Food', '2024-01-17'),
    ];
    const result = computeMetrics(txs);
    expect(result.categoryStats['Food']).toBeDefined();
    expect(result.categoryStats['Food'].mean).toBe(200);
    expect(result.categoryStats['Food'].count).toBe(3);
    expect(result.categoryStats['Food'].stddev).toBeGreaterThan(0);
  });

  it('handles multiple months and categories together', () => {
    const txs = [
      makeTx(100, 'Food', '2024-01-15'),
      makeTx(500, 'Rent', '2024-01-15'),
      makeTx(150, 'Food', '2024-02-15'),
      makeTx(500, 'Rent', '2024-02-15'),
    ];
    const result = computeMetrics(txs);
    expect(result.total).toBe(1250);
    expect(Object.keys(result.monthly)).toHaveLength(2);
    expect(Object.keys(result.byCategory)).toHaveLength(2);
    expect(result.categoryStats['Food'].count).toBe(2);
    expect(result.categoryStats['Rent'].count).toBe(2);
  });
});
