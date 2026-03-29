// ─── EXPORT BUTTON ──────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';
import { exportToCSV, exportToJSON } from '../../utils/exportData';

export function ExportButton({ transactions, t, colors }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') setOpen(false);
  };

  const isDark = colors.bg === '#09090B';

  const buttonBase = {
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
    borderRadius: 8,
    padding: '6px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    color: isDark ? 'rgba(255,255,255,0.6)' : '#475569',
    transition: 'all 0.15s',
  };

  const dropdownItem = {
    width: '100%',
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    color: isDark ? '#D1D5DB' : '#1E293B',
    textAlign: 'left',
    borderRadius: 4,
    transition: 'background 0.1s',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }} onKeyDown={handleKeyDown}>
      <button
        onClick={() => setOpen(prev => !prev)}
        aria-label={t.exportLabel}
        aria-expanded={open}
        aria-haspopup="true"
        style={buttonBase}
      >
        {/* Download icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {t.exportLabel}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: 160,
            background: isDark ? '#161E2E' : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`,
            borderRadius: 8,
            padding: 4,
            zIndex: 50,
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.1)',
          }}
        >
          <button
            role="menuitem"
            onClick={() => { exportToCSV(transactions); setOpen(false); }}
            aria-label={t.exportCSV}
            style={dropdownItem}
            onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {t.exportCSV}
          </button>
          <button
            role="menuitem"
            onClick={() => { exportToJSON(transactions); setOpen(false); }}
            aria-label={t.exportJSON}
            style={dropdownItem}
            onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {t.exportJSON}
          </button>
        </div>
      )}
    </div>
  );
}
