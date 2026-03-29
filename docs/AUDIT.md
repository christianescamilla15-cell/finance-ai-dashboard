# Finance AI Dashboard - Audit Report

**Date:** 2026-03-29
**Scope:** Full codebase audit and P0 refactoring
**Pre-audit:** 83 tests passing, 3,456 LOC across 42 source files

---

## Findings

### P0 - Critical

| # | Issue | File(s) | Resolution |
|---|-------|---------|------------|
| 1 | **Dead legacy monolith** — Root `App.jsx` (566 lines) was an obsolete single-file version of the entire app. Not imported anywhere, duplicated all logic. | `/App.jsx` | Deleted. |
| 2 | **God file: FinanceChatbot.jsx** — 547 lines containing tool definitions, tool execution logic, knowledge base (8 topics, bilingual), intent matching, Claude API orchestration, and full UI. | `src/components/chat/FinanceChatbot.jsx` | Split into 4 modules: `chatbotTools.js` (schema), `chatbotToolExecutor.js` (logic), `chatbotKB.js` (KB + intent matching), `FinanceChatbot.jsx` (UI only, ~180 lines). |
| 3 | **isDark detection bug** — `CategoryManager.jsx` and `ExportButton.jsx` compared `colors.bg` against `#0A0B0F`, but `useTheme` returns `#09090B` for dark mode. This meant light-mode styling was applied in both components when the theme was dark. | `CategoryManager.jsx`, `ExportButton.jsx` | Fixed to compare against `#09090B`. |

### P1 - Architecture

| # | Issue | Resolution |
|---|-------|------------|
| 4 | **Duplicated `APPLE_EASE` constant** — Identical `[0.16, 1, 0.3, 1]` defined in 6 files: `App.jsx`, `KPICards.jsx`, `OverviewTab.jsx`, `AnomalyTable.jsx`, `TransactionList.jsx`, `ForecastPanel.jsx`. | Extracted to `src/constants/animation.js`. All 6 files now import from single source. |
| 5 | **Dead conditional in chatbot** — `apiBase` variable had `localhost` check but both branches returned identical `'/api/chat'`. | Removed conditional, use string directly. |
| 6 | **No tests for chatbot tool execution** — 130+ lines of business logic for 5 financial analysis tools had zero test coverage. | Created `chatbotToolExecutor.test.js` with 13 tests covering all 5 tools, edge cases, and error handling. |
| 7 | **No tests for export utilities** — `exportData.js` (CSV and JSON export) had no tests. | Created `exportData.test.js` with 5 tests. |

### P2 - Style / Low Priority

| # | Issue | Status |
|---|-------|--------|
| 8 | `OnboardingTour.jsx` (381 lines) — borderline god file with duplicated rendering for completion modal vs active tour. Rendering inline styles are verbose but structurally sound. | Documented. Recommend extracting `TourCompletion` and `TourStep` sub-components in a future pass. |
| 9 | Large bundle (825 KB) — Recharts is the main contributor. | Documented. Consider `react-chartjs-2` or lazy-loading chart components with `React.lazy()`. |
| 10 | Inline styles throughout — no CSS modules or styled-components. Consistent pattern but verbose. | Documented. Low urgency; the approach is consistent across the codebase. |

---

## Changes Applied

### Files Deleted (1)
- `/App.jsx` — 566 lines of dead legacy code

### Files Created (5)
- `src/constants/animation.js` — Shared `APPLE_EASE` easing constant
- `src/components/chat/chatbotTools.js` — Claude API tool definitions (5 tools)
- `src/components/chat/chatbotToolExecutor.js` — Tool execution engine (extracted from chatbot)
- `src/components/chat/chatbotKB.js` — Local knowledge base + intent matching (extracted from chatbot)
- `docs/AUDIT.md` — This document

### Files Created (Tests) (2)
- `src/components/chat/__tests__/chatbotToolExecutor.test.js` — 13 tests for tool executor
- `src/utils/__tests__/exportData.test.js` — 5 tests for CSV/JSON export

### Files Modified (8)
- `src/App.jsx` — Import `APPLE_EASE` from constants, remove local definition
- `src/components/chat/FinanceChatbot.jsx` — Refactored from 547 to ~180 lines (imports extracted modules)
- `src/components/dashboard/KPICards.jsx` — Import shared `APPLE_EASE`
- `src/components/dashboard/OverviewTab.jsx` — Import shared `APPLE_EASE`
- `src/components/dashboard/AnomalyTable.jsx` — Import shared `APPLE_EASE`
- `src/components/dashboard/TransactionList.jsx` — Import shared `APPLE_EASE`
- `src/components/dashboard/ForecastPanel.jsx` — Import shared `APPLE_EASE`
- `src/components/dashboard/CategoryManager.jsx` — Fix `isDark` detection (`#0A0B0F` -> `#09090B`)
- `src/components/dashboard/ExportButton.jsx` — Fix `isDark` detection (`#0A0B0F` -> `#09090B`)

---

## Metrics

| Metric | Before | After |
|--------|--------|-------|
| Tests | 83 | 104 (+21) |
| Test files | 7 | 9 (+2) |
| Dead code removed | 0 | 566 lines |
| God files (>400 LOC) | 1 (547 LOC) | 0 |
| Duplicated constants | 6 instances of `APPLE_EASE` | 1 source of truth |
| isDark bugs | 2 components | 0 |
| Build status | Passing | Passing |
| Bundle size | ~825 KB | ~825 KB (no regression) |

---

## Recommendations for Future Work

1. **Code-split Recharts** — Use `React.lazy()` + `Suspense` for chart-heavy tabs to reduce initial bundle.
2. **Extract OnboardingTour sub-components** — Split `TourCompletion` and `TourStep` into separate files.
3. **Add component rendering tests** — KPICards, OverviewTab, and ForecastPanel would benefit from render tests.
4. **Replace inline styles with CSS modules** — Would improve maintainability and enable build-time optimization.
5. **Add E2E tests** — Playwright or Cypress for the import/export flow and tab navigation.
