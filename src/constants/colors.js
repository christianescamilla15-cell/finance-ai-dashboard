// ─── COLORES ──────────────────────────────────────────────────────────────────

export const CAT_COLORS = {
  Marketing: "#3B82F6", Nomina: "#10B981", Software: "#8B5CF6",
  Infraestructura: "#F59E0B", Logistica: "#EF4444", Ventas: "#06B6D4", Operaciones: "#EC4899",
  General: "#6B7280",
};

export const getCatColor = (cat) => CAT_COLORS[cat] || `hsl(${cat.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 55%, 55%)`;
