// ─── THEME HOOK ─────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';

const THEME_KEY = 'finance-ai-theme';

const PALETTES = {
  dark: {
    bg: '#09090B',
    card: '#161E2E',
    text: '#FAFAFA',
    textMuted: 'rgba(255,255,255,0.5)',
    accent: '#6366F1',
    border: 'rgba(255,255,255,0.06)',
    cardBg: 'rgba(255,255,255,0.03)',
    cardBorder: 'rgba(255,255,255,0.06)',
    inputBg: 'rgba(255,255,255,0.04)',
    inputBorder: 'rgba(255,255,255,0.1)',
    headerColor: 'rgba(255,255,255,0.5)',
    subtextColor: 'rgba(255,255,255,0.3)',
    subtextFaint: 'rgba(255,255,255,0.35)',
    rowBorder: 'rgba(255,255,255,0.04)',
    selectBg: '#0a0a0e',
  },
  light: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    text: '#1E293B',
    textMuted: '#64748B',
    accent: '#6366F1',
    border: '#E2E8F0',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    inputBg: '#F1F5F9',
    inputBorder: '#CBD5E1',
    headerColor: '#475569',
    subtextColor: '#64748B',
    subtextFaint: '#94A3B8',
    rowBorder: '#F1F5F9',
    selectBg: '#FFFFFF',
  },
};

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* SSR / privacy mode */ }
  return 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch { /* noop */ }
      return next;
    });
  }, []);

  const colors = useMemo(() => PALETTES[theme], [theme]);

  return { theme, toggleTheme, colors };
}
