// ─── FORMATTING HELPERS ──────────────────────────────────────────────────────

export const fmt = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
