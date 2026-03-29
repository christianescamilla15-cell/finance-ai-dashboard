import { describe, it, expect } from 'vitest';
import { fmt } from '../formatting';

describe('fmt', () => {
  it('formats an integer as MXN currency', () => {
    const result = fmt(1000);
    expect(result).toContain('1,000');
    expect(result).toContain('$');
  });

  it('formats zero', () => {
    const result = fmt(0);
    expect(result).toContain('0');
  });

  it('formats a large number with thousands separators', () => {
    const result = fmt(1234567);
    // Should contain grouping separators
    expect(result).toMatch(/1[,.]234[,.]567/);
  });

  it('formats a negative number', () => {
    const result = fmt(-5000);
    expect(result).toContain('5,000');
    expect(result).toContain('-');
  });

  it('rounds decimals to zero fraction digits', () => {
    const result = fmt(1234.56);
    // maximumFractionDigits: 0 means no decimal part
    expect(result).not.toMatch(/\.\d+/);
  });
});
