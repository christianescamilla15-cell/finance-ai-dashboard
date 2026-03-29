import { describe, it, expect } from 'vitest';
import { parseImportData } from '../csvParser';

describe('parseImportData', () => {
  it('parses basic CSV with header and data rows', () => {
    const csv = `date,amount,category,description
2024-01-15,500,Food,Groceries
2024-01-16,200,Transport,Uber`;
    const { transactions, errors } = parseImportData(csv);
    expect(transactions).toHaveLength(2);
    expect(transactions[0].category).toBe('Transport');
    expect(errors).toBeNull();
  });

  it('auto-detects tab delimiter', () => {
    const tsv = `date\tamount\tcategory
2024-01-15\t500\tFood
2024-01-16\t200\tTransport`;
    const { transactions } = parseImportData(tsv);
    expect(transactions).toHaveLength(2);
    expect(transactions[0].amount).toBe(200);
  });

  it('auto-detects semicolon delimiter', () => {
    const csv = `date;amount;category
2024-01-15;500;Food
2024-01-16;200;Transport`;
    const { transactions } = parseImportData(csv);
    expect(transactions).toHaveLength(2);
  });

  it('parses DD/MM/YYYY date format', () => {
    const csv = `date,amount,category
15/01/2024,500,Food
20/02/2024,300,Transport`;
    const { transactions } = parseImportData(csv);
    expect(transactions).toHaveLength(2);
    expect(transactions[0].date).toBe('2024-02-20');
    expect(transactions[1].date).toBe('2024-01-15');
  });

  it('parses YYYY-MM-DD date format', () => {
    const csv = `date,amount,category
2024-03-10,500,Food`;
    const { transactions } = parseImportData(csv);
    expect(transactions[0].date).toBe('2024-03-10');
  });

  it('strips $ currency symbol from amounts', () => {
    const csv = `date,amount,category
2024-01-15,$1500,Food`;
    const { transactions } = parseImportData(csv);
    expect(transactions[0].amount).toBe(1500);
  });

  it('strips EUR currency symbol from amounts', () => {
    const csv = `date,amount,category
2024-01-15,€2500,Food`;
    const { transactions } = parseImportData(csv);
    expect(transactions[0].amount).toBe(2500);
  });

  it('strips MXN text from amounts', () => {
    const csv = `date,amount,category
2024-01-15,MXN 3500,Food`;
    const { transactions } = parseImportData(csv);
    expect(transactions[0].amount).toBe(3500);
  });

  it('returns error when required columns are missing', () => {
    const csv = `name,category
John,Food`;
    const { transactions, error } = parseImportData(csv);
    expect(transactions).toHaveLength(0);
    expect(error).toContain('fecha');
  });

  it('skips malformed rows and reports errors', () => {
    const csv = `date,amount,category
2024-01-15,500,Food
short_row
2024-01-16,200,Transport`;
    const { transactions, errors } = parseImportData(csv);
    expect(transactions).toHaveLength(2);
    expect(errors).toHaveLength(1);
  });

  it('returns error for empty input', () => {
    const { transactions, error } = parseImportData('');
    expect(transactions).toHaveLength(0);
    expect(error).toBeDefined();
  });

  it('returns error for single line (header only, no data)', () => {
    const { transactions, error } = parseImportData('date,amount,category');
    expect(transactions).toHaveLength(0);
    expect(error).toBeDefined();
  });

  it('recognizes Spanish column headers (fecha, monto, categoria)', () => {
    const csv = `fecha,monto,categoria,descripcion
2024-01-15,500,Comida,Supermercado`;
    const { transactions } = parseImportData(csv);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].category).toBe('Comida');
    expect(transactions[0].description).toBe('Supermercado');
  });

  it('recognizes English column headers (date, amount, category)', () => {
    const csv = `date,amount,category,description
2024-01-15,500,Food,Groceries`;
    const { transactions } = parseImportData(csv);
    expect(transactions[0].category).toBe('Food');
    expect(transactions[0].description).toBe('Groceries');
  });

  it('handles commas as decimal separators (European format)', () => {
    const csv = `date,amount,category
2024-01-15,"1500,50",Food`;
    // amount "1500,50" => "1500.50" => Math.round(Math.abs(1500.5)) = 1500 (rounds to even) or 1501
    const { transactions } = parseImportData(csv);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].amount).toBe(1500);
  });

  it('sorts transactions by date descending', () => {
    const csv = `date,amount,category
2024-01-01,100,A
2024-03-01,300,C
2024-02-01,200,B`;
    const { transactions } = parseImportData(csv);
    expect(transactions[0].date).toBe('2024-03-01');
    expect(transactions[1].date).toBe('2024-02-01');
    expect(transactions[2].date).toBe('2024-01-01');
  });

  it('assigns General as default category when category column is missing', () => {
    const csv = `date,amount
2024-01-15,500`;
    const { transactions } = parseImportData(csv);
    expect(transactions[0].category).toBe('General');
  });

  it('skips rows with invalid date', () => {
    const csv = `date,amount,category
not-a-date,500,Food
2024-01-15,200,Transport`;
    const { transactions, errors } = parseImportData(csv);
    expect(transactions).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('fecha invalida');
  });

  it('skips rows with zero amount', () => {
    const csv = `date,amount,category
2024-01-15,0,Food
2024-01-16,200,Transport`;
    const { transactions, errors } = parseImportData(csv);
    expect(transactions).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
});
