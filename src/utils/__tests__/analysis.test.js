import { describe, it, expect } from 'vitest';
import { generateRealAnalysis } from '../analysis';

const makeTx = (amount, category, date = '2024-01-15', anomalyScore = 0.5) => ({
  id: `TX-${Math.random()}`,
  date,
  category,
  amount,
  description: `${category} transaction`,
  isAnomaly: true,
  anomalyScore,
});

describe('generateRealAnalysis', () => {
  it('returns a string containing DIAGNOSTICO section', () => {
    const allTxs = Array.from({ length: 10 }, (_, i) =>
      makeTx(100, 'Food', `2024-01-${String(i + 10).padStart(2, '0')}`, 0.1)
    );
    const anomaly = makeTx(500, 'Food', '2024-01-25', 0.6);
    allTxs.push(anomaly);
    const result = generateRealAnalysis(anomaly, allTxs);
    expect(result).toContain('DIAGNOSTICO');
  });

  it('includes statistical analysis section', () => {
    const allTxs = Array.from({ length: 10 }, () => makeTx(100, 'Food', '2024-01-15', 0.1));
    const anomaly = makeTx(500, 'Food', '2024-01-20', 0.6);
    allTxs.push(anomaly);
    const result = generateRealAnalysis(anomaly, allTxs);
    expect(result).toContain('ANALISIS ESTADISTICO');
    expect(result).toContain('Media de Food');
    expect(result).toContain('Desviacion estandar');
  });

  it('classifies high risk (ALTO) for anomaly score >= 70', () => {
    const allTxs = Array.from({ length: 10 }, () => makeTx(100, 'Food', '2024-01-15', 0.1));
    const anomaly = makeTx(5000, 'Food', '2024-01-20', 0.85);
    allTxs.push(anomaly);
    const result = generateRealAnalysis(anomaly, allTxs);
    expect(result).toContain('ALTO');
    expect(result).toContain('ACCION INMEDIATA');
  });

  it('classifies medium risk (MEDIO) for anomaly score 40-69', () => {
    const allTxs = Array.from({ length: 10 }, () => makeTx(100, 'Food', '2024-01-15', 0.1));
    const anomaly = makeTx(300, 'Food', '2024-01-20', 0.55);
    allTxs.push(anomaly);
    const result = generateRealAnalysis(anomaly, allTxs);
    expect(result).toContain('MEDIO');
    expect(result).toContain('MONITOREAR');
  });

  it('classifies low risk (BAJO) for anomaly score < 40', () => {
    const allTxs = Array.from({ length: 10 }, () => makeTx(100, 'Food', '2024-01-15', 0.1));
    const anomaly = makeTx(150, 'Food', '2024-01-20', 0.25);
    allTxs.push(anomaly);
    const result = generateRealAnalysis(anomaly, allTxs);
    expect(result).toContain('BAJO');
    expect(result).toContain('REGISTRAR');
  });

  it('shows "superior" for amounts above the mean', () => {
    const allTxs = Array.from({ length: 10 }, () => makeTx(100, 'Food', '2024-01-15', 0.1));
    const anomaly = makeTx(500, 'Food', '2024-01-20', 0.6);
    allTxs.push(anomaly);
    const result = generateRealAnalysis(anomaly, allTxs);
    expect(result).toContain('superior');
  });

  it('shows "inferior" for amounts below the mean', () => {
    const allTxs = Array.from({ length: 10 }, () => makeTx(1000, 'Food', '2024-01-15', 0.1));
    const anomaly = makeTx(50, 'Food', '2024-01-20', 0.6);
    allTxs.push(anomaly);
    const result = generateRealAnalysis(anomaly, allTxs);
    expect(result).toContain('inferior');
  });

  it('shows limited precision note when fewer than 10 transactions in category', () => {
    const allTxs = [
      makeTx(100, 'Food', '2024-01-10', 0.1),
      makeTx(100, 'Food', '2024-01-11', 0.1),
    ];
    const anomaly = makeTx(500, 'Food', '2024-01-20', 0.6);
    allTxs.push(anomaly);
    const result = generateRealAnalysis(anomaly, allTxs);
    expect(result).toContain('precision limitada');
  });

  it('does not show limited precision note when 10+ transactions exist', () => {
    const allTxs = Array.from({ length: 12 }, () => makeTx(100, 'Food', '2024-01-15', 0.1));
    const anomaly = makeTx(500, 'Food', '2024-01-20', 0.6);
    allTxs.push(anomaly);
    const result = generateRealAnalysis(anomaly, allTxs);
    expect(result).not.toContain('precision limitada');
  });
});
