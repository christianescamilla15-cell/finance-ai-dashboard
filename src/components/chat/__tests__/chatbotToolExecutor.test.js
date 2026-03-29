// ─── CHATBOT TOOL EXECUTOR TESTS ────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { executeToolCall } from '../chatbotToolExecutor';

const mockTransactions = [
  { id: '1', date: '2025-01-15', category: 'Marketing', amount: 8000, description: 'Ad spend', isAnomaly: false, anomalyScore: 0.1 },
  { id: '2', date: '2025-01-16', category: 'Marketing', amount: 25000, description: 'Big campaign', isAnomaly: true, anomalyScore: 0.85 },
  { id: '3', date: '2025-02-10', category: 'Software', amount: 3500, description: 'License', isAnomaly: false, anomalyScore: 0.05 },
  { id: '4', date: '2025-02-12', category: 'Nomina', amount: 45000, description: 'Payroll', isAnomaly: false, anomalyScore: 0.02 },
  { id: '5', date: '2025-02-15', category: 'Marketing', amount: 500, description: 'Tiny spend', isAnomaly: true, anomalyScore: 0.65 },
];

const mockAnomalies = mockTransactions.filter(t => t.isAnomaly);

const mockMetrics = {
  total: 82000,
  byCategory: { Marketing: 33500, Software: 3500, Nomina: 45000 },
  monthly: { '2025-01': 33000, '2025-02': 49000 },
  anomalies: mockAnomalies,
  categoryStats: {},
};

const baseCtx = {
  anomalies: mockAnomalies,
  metrics: mockMetrics,
  transactions: mockTransactions,
  forecastData: null,
};

describe('executeToolCall', () => {
  describe('detect_anomalies', () => {
    it('returns all anomalies when no filters', () => {
      const result = executeToolCall('detect_anomalies', {}, baseCtx);
      expect(result.total_anomalies).toBe(2);
      expect(result.total_in_dataset).toBe(2);
    });

    it('filters by category', () => {
      const result = executeToolCall('detect_anomalies', { category: 'Marketing' }, baseCtx);
      expect(result.total_anomalies).toBe(2);
    });

    it('returns empty for non-existent category', () => {
      const result = executeToolCall('detect_anomalies', { category: 'FakeCategory' }, baseCtx);
      expect(result.total_anomalies).toBe(0);
    });
  });

  describe('get_spending_summary', () => {
    it('returns full summary for all periods', () => {
      const result = executeToolCall('get_spending_summary', { period: 'all' }, baseCtx);
      expect(result.total).toBe(82000);
      expect(result.months_count).toBe(2);
      expect(result.total_transactions).toBe(5);
    });

    it('returns last month only', () => {
      const result = executeToolCall('get_spending_summary', { period: 'last_month' }, baseCtx);
      expect(result.months_count).toBe(1);
      expect(result.period_total).toBe(49000);
    });

    it('returns last 3 months', () => {
      const result = executeToolCall('get_spending_summary', { period: 'last_3_months' }, baseCtx);
      expect(result.months_count).toBe(2);
    });
  });

  describe('forecast_cashflow', () => {
    it('returns existing forecast data when available', () => {
      const ctx = {
        ...baseCtx,
        forecastData: {
          proyeccion_mes: 55000,
          tendencia: 'alcista',
          variacion_esperada: 12,
          regression: { r2: 0.85, slope: 8000, intercept: 25000 },
          alertas: ['test alert'],
          recomendaciones: ['test rec'],
        },
      };
      const result = executeToolCall('forecast_cashflow', {}, ctx);
      expect(result.projected_next_month).toBe(55000);
      expect(result.trend).toBe('alcista');
      expect(result.r_squared).toBe(0.85);
    });

    it('computes forecast from monthly data when no forecast exists', () => {
      const result = executeToolCall('forecast_cashflow', {}, baseCtx);
      expect(result.projected_next_month).toBeTypeOf('number');
      expect(result.trend).toBeDefined();
      expect(result.r_squared).toBeTypeOf('number');
    });

    it('returns error with insufficient data', () => {
      const ctx = {
        ...baseCtx,
        metrics: { ...mockMetrics, monthly: { '2025-01': 33000 } },
      };
      const result = executeToolCall('forecast_cashflow', {}, ctx);
      expect(result.error).toMatch(/not enough data/i);
    });
  });

  describe('analyze_category', () => {
    it('analyzes a valid category', () => {
      const result = executeToolCall('analyze_category', { category: 'Marketing' }, baseCtx);
      expect(result.category).toBe('Marketing');
      expect(result.transaction_count).toBe(3);
      expect(result.total).toBeGreaterThan(0);
      expect(result.mean).toBeGreaterThan(0);
      expect(result.anomaly_count).toBe(2);
    });

    it('returns zeros for non-existent category', () => {
      const result = executeToolCall('analyze_category', { category: 'FakeCategory' }, baseCtx);
      expect(result.transaction_count).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('compare_periods', () => {
    it('compares two months by total', () => {
      const result = executeToolCall('compare_periods', { metric: 'total' }, baseCtx);
      expect(result.period_1.month).toBe('2025-01');
      expect(result.period_2.month).toBe('2025-02');
      expect(result.change_pct).toBeTypeOf('number');
    });

    it('compares by category', () => {
      const result = executeToolCall('compare_periods', { metric: 'by_category' }, baseCtx);
      expect(result.period_1.by_category).toBeDefined();
      expect(result.period_2.by_category).toBeDefined();
    });

    it('returns error with insufficient months', () => {
      const ctx = {
        ...baseCtx,
        metrics: { ...mockMetrics, monthly: { '2025-01': 33000 } },
      };
      const result = executeToolCall('compare_periods', { metric: 'total' }, ctx);
      expect(result.error).toMatch(/need at least 2 months/i);
    });
  });

  describe('unknown tool', () => {
    it('returns error for unknown tool name', () => {
      const result = executeToolCall('nonexistent_tool', {}, baseCtx);
      expect(result.error).toMatch(/unknown tool/i);
    });
  });
});
