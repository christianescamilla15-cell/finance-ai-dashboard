// ─── THEME TOGGLE ───────────────────────────────────────────────────────────

export function ThemeToggle({ theme, toggleTheme, lang }) {
  const isDark = theme === 'dark';
  const label = lang === 'es' ? 'Cambiar tema' : 'Toggle theme';

  return (
    <button
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
        borderRadius: 8,
        padding: '6px 10px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.25s ease',
      }}
    >
      {isDark ? (
        /* Sun icon */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon icon */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
