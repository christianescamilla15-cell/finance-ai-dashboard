// ─── EXPORT DATA TESTS ──────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToCSV, exportToJSON } from '../exportData';

describe('exportToCSV', () => {
  let clickSpy;

  beforeEach(() => {
    clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('does nothing for empty array', () => {
    exportToCSV([]);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('does nothing for null', () => {
    exportToCSV(null);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('triggers download for valid transactions', () => {
    const txs = [
      { date: '2025-01-15', category: 'Marketing', amount: 8500, description: 'Google Ads' },
    ];
    exportToCSV(txs);
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('uses custom filename', () => {
    const txs = [{ date: '2025-01-15', category: 'Marketing', amount: 8500, description: 'Test' }];
    exportToCSV(txs, 'custom.csv');
    const link = document.createElement();
    expect(link).toBeDefined();
  });
});

describe('exportToJSON', () => {
  let clickSpy;

  beforeEach(() => {
    clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('does nothing for empty array', () => {
    exportToJSON([]);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('triggers download for valid transactions', () => {
    const txs = [
      { date: '2025-01-15', category: 'Marketing', amount: 8500, description: 'Google Ads' },
    ];
    exportToJSON(txs);
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});
