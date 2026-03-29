// ─── TRANSACTION LIST / TAB ──────────────────────────────────────────────────
import { memo } from "react";
import { motion } from "framer-motion";
import { fmt } from '../../utils/formatting';
import { getCatColor } from '../../constants/colors';
import { CategoryManager } from './CategoryManager';
import { APPLE_EASE } from '../../constants/animation';

const TransactionRow = memo(function TransactionRow({ tx, colors, index }) {
  const isDark = !colors || colors.bg === '#09090B' || colors.bg === '#0A0B0F';
  const textColor = isDark ? "#D1D5DB" : "#1E293B";
  const dateColor = isDark ? "rgba(255,255,255,0.3)" : "#64748B";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.5), duration: 0.35, ease: APPLE_EASE }}
      style={{
        display: "grid", gridTemplateColumns: "1fr auto auto auto",
        padding: "10px 16px", alignItems: "center", gap: 12,
        borderBottom: `1px solid ${colors ? colors.rowBorder : "rgba(255,255,255,0.04)"}`,
        background: tx.isAnomaly ? "rgba(239,68,68,0.04)" : "transparent",
        transition: "background 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      onMouseEnter={e => { if (!tx.isAnomaly) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"; }}
      onMouseLeave={e => { if (!tx.isAnomaly) e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {tx.isAnomaly && <span aria-label="Transaccion anomala" style={{ fontSize: 10, color: "#EF4444", fontWeight: 700, textShadow: "0 0 6px rgba(239,68,68,0.4)" }}>!</span>}
        <span style={{ fontSize: 12, color: textColor }}>{tx.description}</span>
      </div>
      <span style={{
        fontSize: 10, padding: "2px 8px", borderRadius: 6,
        background: `${getCatColor(tx.category)}15`,
        color: getCatColor(tx.category), fontFamily: "'DM Mono', monospace",
      }}>{tx.category}</span>
      <span style={{ fontSize: 11, color: dateColor, fontFamily: "'DM Mono', monospace" }}>{tx.date}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: tx.isAnomaly ? "#F87171" : textColor, fontFamily: "'DM Mono', monospace" }}>
        {fmt(tx.amount)}
      </span>
    </motion.div>
  );
});

export function TransactionList({ recentTxs, allCategories, searchTerm, setSearchTerm, filterCat, setFilterCat, t, colors, customCategories, onAddCategory }) {
  const isDark = !colors || colors.bg === '#09090B' || colors.bg === '#0A0B0F';
  const inputBg = colors ? colors.inputBg : "rgba(255,255,255,0.04)";
  const inputBorder = colors ? colors.inputBorder : "rgba(255,255,255,0.1)";
  const inputColor = isDark ? "#FAFAFA" : "#1E293B";
  const cardBg = colors ? colors.cardBg : "rgba(255,255,255,0.02)";
  const cardBorder = colors ? colors.cardBorder : "rgba(255,255,255,0.06)";
  const headerColor = isDark ? "rgba(255,255,255,0.3)" : "#64748B";
  const selectBg = colors ? colors.selectBg : "#0a0a0e";

  return (
    <div data-tour="transactions-tab">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: APPLE_EASE }}
        style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}
      >
        <label htmlFor="tx-search" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
          {t.buscarTransaccion}
        </label>
        <input
          id="tx-search"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder={t.buscarTransaccion}
          aria-label={t.buscarTransaccion}
          style={{
            flex: 1, background: inputBg,
            border: `1px solid ${inputBorder}`,
            borderRadius: 12, padding: "9px 14px",
            color: inputColor, fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
            backdropFilter: isDark ? "blur(12px)" : "none",
            transition: "border-color 0.3s, box-shadow 0.3s",
          }}
          onFocus={e => { if (isDark) { e.target.style.borderColor = "rgba(16,185,129,0.4)"; e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.08)"; } }}
          onBlur={e => { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = "none"; }}
        />
        <label htmlFor="tx-category-filter" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
          {t.todasCategorias}
        </label>
        <select
          id="tx-category-filter"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          aria-label="Filtrar por categoria"
          style={{
            background: inputBg,
            border: `1px solid ${inputBorder}`,
            borderRadius: 12, padding: "9px 14px",
            color: inputColor, fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
            colorScheme: isDark ? "dark" : "light",
          }}
        >
          <option style={{ background: selectBg }} value="Todas">{t.todasCategorias}</option>
          {allCategories.map(c => (
            <option key={c} style={{ background: selectBg }} value={c}>{c}</option>
          ))}
        </select>
        {colors && onAddCategory && (
          <CategoryManager
            allCategories={allCategories}
            customCategories={customCategories || []}
            onAddCategory={onAddCategory}
            t={t}
            colors={colors}
          />
        )}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: APPLE_EASE }}
        role="table" aria-label="Lista de transacciones"
        style={{
          background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, overflow: "hidden",
          backdropFilter: isDark ? "blur(12px)" : "none",
        }}
      >
        <div role="row" style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", padding: "10px 16px", borderBottom: `1px solid ${cardBorder}` }}>
          {[t.descripcion, t.categoria, t.fecha, t.monto].map(h => (
            <span key={h} role="columnheader" style={{ fontSize: 10, fontWeight: 700, color: headerColor, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{h}</span>
          ))}
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {recentTxs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ fontSize: 12, color: headerColor, margin: 0 }}>
                {t.noTransacciones}
              </p>
            </div>
          ) : (
            recentTxs.map((tx, i) => (
              <TransactionRow key={tx.id} tx={tx} colors={colors} index={i} />
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
