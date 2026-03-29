import { describe, it, expect } from 'vitest';
import { calcMean, calcStdDev, linearRegression } from '../statistics';

describe('calcMean', () => {
  it('returns 0 for an empty array', () => {
    expect(calcMean([])).toBe(0);
  });

  it('returns the value itself for a single-element array', () => {
    expect(calcMean([42])).toBe(42);
  });

  it('calculates the mean of positive values', () => {
    expect(calcMean([10, 20, 30])).toBe(20);
  });

  it('calculates the mean of mixed positive and negative values', () => {
    expect(calcMean([-10, 10])).toBe(0);
  });

  it('handles large numbers correctly', () => {
    expect(calcMean([1e9, 2e9, 3e9])).toBe(2e9);
  });

  it('handles decimal values', () => {
    expect(calcMean([1.5, 2.5, 3.0])).toBeCloseTo(2.3333, 3);
  });
});

describe('calcStdDev', () => {
  it('returns 0 for an empty array', () => {
    expect(calcStdDev([])).toBe(0);
  });

  it('returns 0 for a single-element array', () => {
    expect(calcStdDev([100])).toBe(0);
  });

  it('returns 0 for identical values', () => {
    expect(calcStdDev([5, 5, 5, 5])).toBe(0);
  });

  it('calculates correct sample standard deviation for known data', () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] => mean=5, sample variance=4, stddev=2
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(calcStdDev(data)).toBeCloseTo(2.138, 2);
  });

  it('calculates correct stddev for two values', () => {
    // [0, 10] => mean=5, sample var = 50, stddev = sqrt(50) ~ 7.07
    expect(calcStdDev([0, 10])).toBeCloseTo(7.071, 2);
  });

  it('handles a large dataset consistently', () => {
    const data = Array.from({ length: 1000 }, (_, i) => i);
    const result = calcStdDev(data);
    // stddev of 0..999 with sample correction ~ 288.82
    expect(result).toBeCloseTo(288.82, 0);
  });
});

describe('linearRegression', () => {
  it('returns intercept only when n < 2', () => {
    const result = linearRegression([1], [5]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(5);
    expect(result.r2).toBe(0);
  });

  it('returns intercept 0 for empty arrays', () => {
    const result = linearRegression([], []);
    expect(result.intercept).toBe(0);
  });

  it('calculates perfect linear fit for two points', () => {
    const result = linearRegression([0, 1], [0, 2]);
    expect(result.slope).toBeCloseTo(2, 5);
    expect(result.intercept).toBeCloseTo(0, 5);
    expect(result.r2).toBeCloseTo(1, 5);
  });

  it('calculates perfect linear fit for multiple points', () => {
    // y = 3x + 1
    const xs = [0, 1, 2, 3, 4];
    const ys = [1, 4, 7, 10, 13];
    const result = linearRegression(xs, ys);
    expect(result.slope).toBeCloseTo(3, 5);
    expect(result.intercept).toBeCloseTo(1, 5);
    expect(result.r2).toBeCloseTo(1, 5);
  });

  it('returns r2 < 1 for noisy data', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [1, 3, 2, 5, 4];
    const result = linearRegression(xs, ys);
    expect(result.r2).toBeGreaterThan(0);
    expect(result.r2).toBeLessThan(1);
  });

  it('handles zero variance in x (all same x)', () => {
    const result = linearRegression([3, 3, 3], [1, 2, 3]);
    expect(result.slope).toBe(0);
  });

  it('handles zero variance in y (all same y)', () => {
    const result = linearRegression([1, 2, 3], [5, 5, 5]);
    expect(result.slope).toBe(0);
    expect(result.r2).toBe(0);
  });

  it('calculates negative slope for decreasing data', () => {
    const xs = [0, 1, 2, 3];
    const ys = [10, 7, 4, 1];
    const result = linearRegression(xs, ys);
    expect(result.slope).toBeCloseTo(-3, 5);
    expect(result.r2).toBeCloseTo(1, 5);
  });
});
