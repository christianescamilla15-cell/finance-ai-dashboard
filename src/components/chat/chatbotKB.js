// ─── CHATBOT LOCAL KNOWLEDGE BASE ────────────────────────────────────────────
// Offline keyword-matched responses used as fallback when Claude API is unavailable.

import { fmt } from '../../utils/formatting';

/**
 * Build the knowledge base from current dashboard state.
 * @param {{ metrics, transactions, anomalies, forecastData, activeTab, lang }} ctx
 * @returns {Record<string, { keys: string[], response: string }>}
 */
export function buildKB(ctx) {
  const { metrics, transactions, anomalies, forecastData, activeTab, lang } = ctx;

  const totalTx = transactions.length;
  const anomalyCount = anomalies.length;
  const anomalyPct = totalTx > 0 ? Math.round((anomalyCount / totalTx) * 100) : 0;
  const months = Object.keys(metrics.monthly).length;
  const topCat = Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1]);
  const avgMonthly = metrics.total / Math.max(months, 1);

  const isEN = lang === 'en';

  return {
    overview: {
      keys: ["overview", "resumen", "general", "inicio", "dashboard", "que veo", "que es esto", "explicar", "ayuda", "help", "hola", "buenas", "what is this", "what"],
      response: isEN
        ? `This is **FinanceAI**, an intelligent financial analysis dashboard. It has 4 sections:\n\n- **Overview** — Main KPIs: total spending (${fmt(metrics.total)}), anomalies (${anomalyCount}), monthly average (${fmt(Math.round(avgMonthly))}), and trend + category charts.\n\n- **Anomalies** — Transactions flagged as outliers using statistical z-score (threshold: 2 standard deviations). You can analyze each one in detail.\n\n- **Transactions** — Full table with search and category filters.\n\n- **Projection** — Forecast based on linear regression with alerts and recommendations.\n\nAsk me about any section or concept.`
        : `Este es **FinanceAI**, un dashboard de analisis financiero inteligente. Tienes 4 secciones:\n\n• **Overview** — KPIs principales: gasto total (${fmt(metrics.total)}), anomalias (${anomalyCount}), promedio mensual (${fmt(Math.round(avgMonthly))}), y graficas de tendencia + distribucion por categoria.\n\n• **Anomalias** — Transacciones detectadas como atipicas usando z-score estadistico (umbral: 2 desviaciones estandar). Puedes analizar cada una en detalle.\n\n• **Transacciones** — Tabla completa con busqueda y filtros por categoria.\n\n• **Proyeccion** — Forecast basado en regresion lineal con alertas y recomendaciones.\n\nPreguntame sobre cualquier seccion o concepto.`,
    },
    anomalias: {
      keys: ["anomalia", "anomalias", "atipic", "riesgo", "fraude", "sospech", "alerta", "z-score", "zscore", "desviacion", "sigma", "anomaly", "anomalies", "risk", "fraud", "outlier"],
      response: isEN
        ? `**${anomalyCount} anomalies** detected (${anomalyPct}% of ${totalTx} transactions).\n\n**How detection works:**\n1. Mean and standard deviation are calculated per category\n2. If a transaction is more than **2 standard deviations** from the mean, it's flagged\n3. Risk score (0-100%) is based on distance from mean (normalized to 5 sigma)\n\n**Risk levels:**\n- **High (>70%)** — Immediate action required\n- **Medium (40-70%)** — Monitor closely\n- **Low (<40%)** — Document for review\n\nClick any anomaly to see detailed analysis with diagnosis, causes and recommendations.${activeTab !== "anomalias" ? "\n\nWant to go to the Anomalies section?" : ""}`
        : `Se detectaron **${anomalyCount} anomalias** (${anomalyPct}% del total de ${totalTx} transacciones).\n\n**Como funciona la deteccion:**\n1. Se calcula la media y desviacion estandar por categoria\n2. Si una transaccion esta a mas de **2 desviaciones estandar** de la media, se marca como anomalia\n3. El score de riesgo (0-100%) se basa en que tan lejos esta de la media (normalizado a 5 sigma)\n\n**Niveles de riesgo:**\n• **Alto (>70%)** — Accion inmediata requerida\n• **Medio (40-70%)** — Monitorear de cerca\n• **Bajo (<40%)** — Documentar para revision\n\nHaz click en cualquier anomalia para ver el analisis detallado con diagnostico, causas y recomendaciones.${activeTab !== "anomalias" ? "\n\n¿Quieres ir a la seccion de anomalias?" : ""}`,
    },
    transacciones: {
      keys: ["transaccion", "transacciones", "tabla", "buscar", "filtrar", "movimiento", "gasto", "pago", "transaction", "transactions", "table", "search", "filter"],
      response: isEN
        ? `There are **${totalTx} transactions** over a ${months}-month period.\n\n**Features:**\n- **Search** — Type any text to filter by description or category\n- **Category filter** — Select a specific category\n- Anomalous transactions are highlighted in **red**\n\n**Available categories:** ${topCat.map(([c, v]) => `${c} (${fmt(v)})`).join(", ")}${activeTab !== "transacciones" ? "\n\nWant to go to the Transactions section?" : ""}`
        : `Hay **${totalTx} transacciones** en el periodo de ${months} meses.\n\n**Funcionalidades:**\n• **Busqueda** — Escribe cualquier texto para filtrar por descripcion o categoria\n• **Filtro por categoria** — Selecciona una categoria especifica\n• Las transacciones anomalas se resaltan en **rojo**\n\n**Categorias disponibles:** ${topCat.map(([c, v]) => `${c} (${fmt(v)})`).join(", ")}${activeTab !== "transacciones" ? "\n\n¿Quieres ir a la seccion de transacciones?" : ""}`,
    },
    proyeccion: {
      keys: ["proyeccion", "forecast", "prediccion", "futuro", "proximo mes", "regresion", "tendencia", "r2", "lineal", "projection", "prediction", "next month", "trend"],
      response: forecastData && !forecastData.error
        ? (isEN
          ? `**Projection generated:**\n- Next month: **${fmt(forecastData.proyeccion_mes)}**\n- Trend: **${forecastData.tendencia}**\n- Expected variation: **${forecastData.variacion_esperada > 0 ? "+" : ""}${forecastData.variacion_esperada}%**\n- Model R\u00B2: **${Math.round(forecastData.regression?.r2 * 100)}%** (${forecastData.regression?.r2 > 0.7 ? "good fit" : forecastData.regression?.r2 > 0.4 ? "moderate fit" : "low fit"})\n\n**How it works:**\nLinear regression is applied to monthly totals. The model fits a line (y = slope x month + intercept) and extends it. R\u00B2 indicates how well the line fits the data.\n\nAlerts and recommendations are auto-generated by analyzing category trends, spending concentration and anomaly rate.`
          : `**Proyeccion generada:**\n\u2022 Proximo mes: **${fmt(forecastData.proyeccion_mes)}**\n\u2022 Tendencia: **${forecastData.tendencia}**\n\u2022 Variacion esperada: **${forecastData.variacion_esperada > 0 ? "+" : ""}${forecastData.variacion_esperada}%**\n\u2022 R\u00B2 del modelo: **${Math.round(forecastData.regression?.r2 * 100)}%** (${forecastData.regression?.r2 > 0.7 ? "buen ajuste" : forecastData.regression?.r2 > 0.4 ? "ajuste moderado" : "ajuste bajo"})\n\n**Como funciona:**\nSe aplica regresion lineal sobre los totales mensuales. El modelo calcula una recta (y = pendiente \u00D7 mes + intercepto) y la extiende al siguiente mes. El R\u00B2 indica que tan bien se ajusta la recta a los datos.\n\nLas alertas y recomendaciones se generan automaticamente analizando tendencias por categoria, concentracion de gasto y tasa de anomalias.`)
        : (isEN
          ? `The projection uses **linear regression** on monthly data to predict next month's spending.\n\n**Methodology:**\n1. Transactions are grouped by month\n2. A line is fitted using least squares\n3. R\u00B2 is calculated to measure reliability\n4. Alerts are generated based on: category growth, spending concentration, and anomaly rate\n\nGo to the "Projection" section and click "Generate Projection" to see it in action.${activeTab !== "proyeccion" ? "\n\nWant to go to the Projection section?" : ""}`
          : `La proyeccion usa **regresion lineal** sobre los datos mensuales para predecir el gasto del proximo mes.\n\n**Metodologia:**\n1. Se agrupan las transacciones por mes\n2. Se ajusta una recta con minimos cuadrados\n3. Se calcula R\u00B2 para medir la confiabilidad\n4. Se generan alertas basadas en: crecimiento por categoria, concentracion de gasto, y tasa de anomalias\n\nVe a la seccion "Proyeccion" y haz click en "Generar Proyeccion" para verlo en accion.${activeTab !== "proyeccion" ? "\n\n¿Quieres ir a la seccion de proyeccion?" : ""}`),
    },
    categorias: {
      keys: ["categoria", "categorias", "distribucion", "pie", "donut", "desglose", "marketing", "nomina", "software", "infraestructura", "logistica", "ventas", "operaciones", "category", "categories", "distribution", "breakdown"],
      response: isEN
        ? `**Category distribution:**\n${topCat.map(([c, v]) => `- **${c}**: ${fmt(v)} (${Math.round(v / metrics.total * 100)}%)`).join("\n")}\n\nThe donut chart shows this distribution visually. Each category has its own color \u2014 hover to see exact amounts.\n\nThe most concentrated category is **${topCat[0]?.[0]}** at ${Math.round((topCat[0]?.[1] || 0) / metrics.total * 100)}% of total spending.`
        : `**Distribucion por categoria:**\n${topCat.map(([c, v]) => `\u2022 **${c}**: ${fmt(v)} (${Math.round(v / metrics.total * 100)}%)`).join("\n")}\n\nLa grafica de dona muestra esta distribucion visualmente. Cada categoria tiene su propio color y puedes pasar el cursor sobre cada seccion para ver el monto exacto.\n\nLa categoria con mayor concentracion es **${topCat[0]?.[0]}** con ${Math.round((topCat[0]?.[1] || 0) / metrics.total * 100)}% del gasto total.`,
    },
    importar: {
      keys: ["importar", "csv", "datos", "cargar", "subir", "archivo", "pegar", "excel", "propio", "import", "upload", "data", "file", "paste"],
      response: isEN
        ? "You can import your own data in two ways:\n\n**1. CSV file** \u2014 Upload a .csv, .tsv or .txt file\n**2. Paste data** \u2014 Copy and paste directly from Excel or Google Sheets\n\n**Required format:**\n```\ndate,category,amount,description\n2025-01-15,Marketing,8500,Google Ads Campaign\n```\n\n**Minimum columns:** date + amount\n**Date formats:** YYYY-MM-DD, DD/MM/YYYY\n**Separators:** comma, tab, semicolon\n\nWhen you import, the system automatically recalculates all anomalies, metrics and projections with your real data.\n\nLook for the **\"Import CSV\"** or **\"Paste data\"** buttons in the top bar."
        : "Puedes importar tus propios datos de dos formas:\n\n**1. Archivo CSV** \u2014 Sube un archivo .csv, .tsv o .txt\n**2. Pegar datos** \u2014 Copia y pega directamente desde Excel o Google Sheets\n\n**Formato requerido:**\n```\nfecha,categoria,monto,descripcion\n2025-01-15,Marketing,8500,Campana Google Ads\n```\n\n**Columnas minimas:** fecha + monto\n**Formatos de fecha:** YYYY-MM-DD, DD/MM/YYYY\n**Separadores:** coma, tab, punto y coma\n\nAl importar, el sistema recalcula automaticamente todas las anomalias, metricas y proyecciones con tus datos reales.\n\nBusca los botones **\"Importar CSV\"** o **\"Pegar datos\"** en la barra superior.",
    },
    kpi: {
      keys: ["kpi", "indicador", "metrica", "tarjeta", "card", "total", "promedio", "gasto total", "metric", "average", "spending"],
      response: isEN
        ? `**Main KPIs:**\n\n- **Total Spending**: ${fmt(metrics.total)} \u2014 Sum of all transactions in the period\n- **Anomalies Detected**: ${anomalyCount} (${anomalyPct}%) \u2014 Transactions exceeding 2 standard deviations\n- **Top Category**: ${topCat[0]?.[0]} (${fmt(topCat[0]?.[1] || 0)}) \u2014 Where most spending is concentrated\n- **Monthly Average**: ${fmt(Math.round(avgMonthly))} \u2014 Total divided by ${months} months\n\nThe sparklines below each KPI show the monthly trend. Hover over them for exact values.`
        : `**KPIs principales:**\n\n\u2022 **Gasto Total**: ${fmt(metrics.total)} \u2014 Suma de todas las transacciones en el periodo\n\u2022 **Anomalias Detectadas**: ${anomalyCount} (${anomalyPct}%) \u2014 Transacciones que superan 2 desviaciones estandar\n\u2022 **Mayor Categoria**: ${topCat[0]?.[0]} (${fmt(topCat[0]?.[1] || 0)}) \u2014 Donde se concentra mas gasto\n\u2022 **Promedio Mensual**: ${fmt(Math.round(avgMonthly))} \u2014 Total dividido entre ${months} meses\n\nLas minilineas (sparklines) debajo de cada KPI muestran la tendencia mensual. Pasa el cursor sobre ellas para ver valores exactos.`,
    },
    graficas: {
      keys: ["grafica", "grafico", "chart", "area", "linea", "barra", "visualiz", "graph", "visualization"],
      response: isEN
        ? "The dashboard has 4 chart types:\n\n- **Area Chart (Overview)** \u2014 Shows monthly spending as a shaded area. The shape reveals trends: rises, drops or stability.\n\n- **Donut Chart (Overview)** \u2014 Spending proportion by category. Hover to see exact amounts.\n\n- **Risk Distribution (Anomalies)** \u2014 Horizontal bars showing how many anomalies exist per risk level (High/Medium/Low).\n\n- **Forecast Chart (Projection)** \u2014 Solid green line (historical) + dashed purple line (projection). Includes average reference line.\n\nAll charts are interactive \u2014 hover to see detailed tooltips."
        : "El dashboard tiene 4 tipos de graficas:\n\n\u2022 **Area Chart (Overview)** \u2014 Muestra el gasto mensual como area sombreada. La forma revela tendencias: subidas, bajadas o estabilidad.\n\n\u2022 **Donut Chart (Overview)** \u2014 Proporcion del gasto por categoria. Pasa el cursor para ver montos exactos.\n\n\u2022 **Risk Distribution (Anomalias)** \u2014 Barras horizontales mostrando cuantas anomalias hay por nivel de riesgo (Alto/Medio/Bajo).\n\n\u2022 **Forecast Chart (Proyeccion)** \u2014 Linea verde solida (datos historicos) + linea morada punteada (proyeccion). Incluye linea de referencia del promedio.\n\nTodas las graficas son interactivas \u2014 pasa el cursor para ver tooltips con datos detallados.",
    },
    metodologia: {
      keys: ["metodologia", "como funciona", "explicar", "tecnico", "estadistic", "modelo", "algoritmo", "ciencia", "methodology", "how does it work", "technical", "model", "algorithm"],
      response: isEN
        ? "**Dashboard methodology:**\n\n**1. Anomaly detection (z-score):**\n- For each category: mean (\u03BC) and standard deviation (\u03C3)\n- Anomaly if |amount - \u03BC| / \u03C3 > 2\n- Normalized score: distance / 5\u03C3 x 100%\n\n**2. Linear regression (forecast):**\n- Variables: X = month index, Y = monthly spending\n- Minimizes the sum of squared errors\n- R\u00B2 measures goodness of fit (0-100%)\n- Projection: Y_next = slope x (N+1) + intercept\n\n**3. Automatic alerts:**\n- Categories with >25% monthly growth\n- Spending concentration >30% in one category\n- Anomaly rate >3% of total\n- High variability (coefficient of variation >20%)"
        : "**Metodologia del dashboard:**\n\n**1. Deteccion de anomalias (z-score):**\n- Para cada categoria: media (\u03BC) y desviacion estandar (\u03C3)\n- Anomalia si |monto - \u03BC| / \u03C3 > 2\n- Score normalizado: distancia / 5\u03C3 \u00D7 100%\n\n**2. Regresion lineal (forecast):**\n- Variables: X = indice del mes, Y = gasto mensual\n- Minimiza la suma de errores cuadraticos\n- R\u00B2 mide la bondad de ajuste (0-100%)\n- Proyeccion: Y_siguiente = pendiente \u00D7 (N+1) + intercepto\n\n**3. Alertas automaticas:**\n- Categorias con crecimiento >25% mensual\n- Concentracion de gasto >30% en una categoria\n- Tasa de anomalias >3% del total\n- Alta variabilidad (coeficiente de variacion >20%)",
    },
  };
}

/**
 * Match user input against KB entries and navigation intents.
 * @param {string} text
 * @param {Record<string, { keys: string[], response: string }>} KB
 * @param {function} onNavigate
 * @param {string} lang
 * @returns {string}
 */
export function matchIntent(text, KB, onNavigate, lang) {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let bestMatch = null;
  let bestScore = 0;

  for (const [, entry] of Object.entries(KB)) {
    let score = 0;
    for (const key of entry.keys) {
      const nKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalized.includes(nKey)) score++;
    }
    if (score > bestScore) { bestScore = score; bestMatch = entry; }
  }

  if (bestMatch && bestScore > 0) return bestMatch.response;

  // Navigation intents
  if (/ir a|llevar|mostrar|abrir|go to|show|open/.test(normalized)) {
    if (/anomal/.test(normalized)) { onNavigate("anomalias"); return lang === 'en' ? "Done, I took you to the **Anomalies** section." : "Listo, te lleve a la seccion de **Anomalias**."; }
    if (/transac/.test(normalized)) { onNavigate("transacciones"); return lang === 'en' ? "Done, I took you to the **Transactions** section." : "Listo, te lleve a la seccion de **Transacciones**."; }
    if (/proyec|forecast|project/.test(normalized)) { onNavigate("proyeccion"); return lang === 'en' ? "Done, I took you to the **Projection** section." : "Listo, te lleve a la seccion de **Proyeccion**."; }
    if (/overview|inicio|resumen|home/.test(normalized)) { onNavigate("overview"); return lang === 'en' ? "Done, I took you to the **Overview**." : "Listo, te lleve al **Overview**."; }
  }

  return lang === 'en'
    ? "I can help you with:\n\n- **Dashboard** \u2014 What each section shows\n- **Anomalies** \u2014 How they are detected and what they mean\n- **Projection** \u2014 How the forecast works\n- **Categories** \u2014 Spending distribution\n- **Import data** \u2014 How to upload your own CSV\n- **Charts** \u2014 What each visualization represents\n- **Methodology** \u2014 Technical model explanation\n\nI can also navigate: say **\"go to anomalies\"** or **\"go to projection\"**."
    : "Puedo ayudarte con:\n\n\u2022 **Dashboard** \u2014 Que muestra cada seccion\n\u2022 **Anomalias** \u2014 Como se detectan y que significan\n\u2022 **Proyeccion** \u2014 Como funciona el forecast\n\u2022 **Categorias** \u2014 Distribucion del gasto\n\u2022 **Importar datos** \u2014 Como subir tu propio CSV\n\u2022 **Graficas** \u2014 Que representa cada visualizacion\n\u2022 **Metodologia** \u2014 Explicacion tecnica del modelo\n\nTambien puedo navegar: di **\"ir a anomalias\"** o **\"ir a proyeccion\"**.";
}
