// ─── CATEGORY MANAGER ───────────────────────────────────────────────────────
import { useState } from 'react';
import { getCatColor } from '../../constants/colors';

export function CategoryManager({ allCategories, customCategories, onAddCategory, t, colors }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366F1');

  const isDark = colors.bg === '#09090B';

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddCategory({ name: trimmed, color: newColor });
    setNewName('');
    setNewColor('#6366F1');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') setOpen(false);
  };

  const allCats = [
    ...allCategories.map(c => ({ name: c, color: getCatColor(c), isCustom: false })),
    ...customCategories.map(c => ({ ...c, isCustom: true })),
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(prev => !prev)}
        aria-label={t.manageCategories}
        aria-expanded={open}
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
          borderRadius: 8,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: "'DM Sans', sans-serif",
          color: isDark ? 'rgba(255,255,255,0.6)' : '#475569',
          transition: 'all 0.15s',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        {t.manageCategories}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.manageCategories}
          onKeyDown={handleKeyDown}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: 280,
            background: isDark ? '#161E2E' : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`,
            borderRadius: 10,
            padding: 16,
            zIndex: 50,
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.1)',
          }}
        >
          {/* Category list */}
          <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 12 }}>
            {allCats.map((cat, i) => (
              <div key={`${cat.name}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 0',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9'}`,
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: 3,
                  background: cat.color, flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 12, flex: 1,
                  color: isDark ? '#D1D5DB' : '#1E293B',
                }}>
                  {cat.name}
                </span>
                {cat.isCustom && (
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 4,
                    background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
                    color: '#6366F1', fontFamily: "'DM Mono', monospace",
                  }}>
                    custom
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Add new category */}
          <p style={{
            margin: '0 0 8px', fontSize: 10, fontWeight: 700,
            color: isDark ? 'rgba(255,255,255,0.35)' : '#64748B',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            fontFamily: "'DM Mono', monospace",
          }}>
            {t.addCategory}
          </p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              aria-label="Color de categoria"
              style={{
                width: 28, height: 28, padding: 0, border: 'none',
                background: 'transparent', cursor: 'pointer', borderRadius: 4,
              }}
            />
            <label htmlFor="new-cat-name" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
              {t.categoryName}
            </label>
            <input
              id="new-cat-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t.categoryName}
              aria-label={t.categoryName}
              style={{
                flex: 1, padding: '6px 10px', fontSize: 12,
                background: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
                borderRadius: 6, color: isDark ? '#F1F5F9' : '#1E293B',
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <button
              onClick={handleAdd}
              aria-label={t.addCategory}
              disabled={!newName.trim()}
              style={{
                background: '#6366F1',
                border: 'none', borderRadius: 6,
                padding: '6px 10px', cursor: newName.trim() ? 'pointer' : 'not-allowed',
                opacity: newName.trim() ? 1 : 0.5,
                color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1,
              }}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
