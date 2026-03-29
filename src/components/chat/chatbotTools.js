// ─── CHATBOT TOOL DEFINITIONS ────────────────────────────────────────────────
// Claude API tool-use schema for financial queries.

export const FINANCE_TOOLS = [
  {
    name: "detect_anomalies",
    description: "Detect anomalous transactions using z-score statistical analysis. Returns transactions that deviate >2 standard deviations from their category mean.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category (optional). Options: Marketing, Nomina, Software, Infraestructura, Logistica, Ventas, Operaciones" },
        risk_level: { type: "string", enum: ["all", "high", "medium", "low"], description: "Filter by risk level" }
      }
    }
  },
  {
    name: "get_spending_summary",
    description: "Get spending summary with totals by category, monthly trends, and averages.",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["all", "last_month", "last_3_months"], description: "Time period" }
      }
    }
  },
  {
    name: "forecast_cashflow",
    description: "Generate cash flow projection using linear regression on monthly spending data. Returns projected amount, trend, R-squared confidence, and recommendations.",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "analyze_category",
    description: "Deep analysis of a specific spending category: mean, std deviation, trend, anomaly count, month-over-month growth.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Category name to analyze" }
      },
      required: ["category"]
    }
  },
  {
    name: "compare_periods",
    description: "Compare spending between two months or periods.",
    input_schema: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["total", "anomalies", "by_category"], description: "What to compare" }
      }
    }
  }
];
